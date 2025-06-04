import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import ExcelJS from "exceljs";
import { authorize } from "@/lib/sessionRoleValidator";
import { Status, handlePrismaError } from "@/lib/status";

const ALLOWED_ROLES = [1, 4];
const LOGO_URL = "https://res.cloudinary.com/dw7txgvbh/image/upload/v1744046207/almapac-logo.png";

const blackBorder = {
  top:    { style: "thin", color: { argb: "FF000000" } },
  left:   { style: "thin", color: { argb: "FF000000" } },
  bottom: { style: "thin", color: { argb: "FF000000" } },
  right:  { style: "thin", color: { argb: "FF000000" } },
};

function getFileName() {
  const now = new Date();
  const pad = n => String(n).padStart(2, "0");
  const [yyyy, mm, dd, hh, min] = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
  ];
  return `Recepciones ${yyyy}-${mm}-${dd} ${hh}-${min}.xlsx`;
}

function buildFixedColumns() {
  return [
    { header: "ID",           key: "id",           width: 10 },
    { header: "Fecha",        key: "fecha",        width: 15 },
    { header: "Barco",        key: "nombreBarco",  width: 20 },
    { header: "Producto",     key: "producto",     width: 20 },
    { header: "Fecha Inicio", key: "fechaInicio",  width: 15 },
    { header: "Fecha Cierre", key: "fechaCierre",  width: 15 },
    { header: "Chequero",     key: "chequero",     width: 15 },
    { header: "Inicio Turno", key: "turnoInicio",  width: 15 },
    { header: "Fin Turno",    key: "turnoFin",     width: 15 },
    { header: "Carga",        key: "puntoCarga",   width: 20 },
    { header: "Descarga",     key: "puntoDescarga",width: 20 },
  ];
}

function buildDynamicColumns(maxEventos) {
  return Array.from({ length: maxEventos }, (_, i) => ([
    { header: `Bitácora ${i + 1} - Placa`,      key: `placa_${i}`,    width: 15 },
    { header: `Bitácora ${i + 1} - Ticket`,     key: `ticket_${i}`,   width: 15 },
    { header: `Bitácora ${i + 1} - Inicio`,     key: `horaIni_${i}`,  width: 15 },
    { header: `Bitácora ${i + 1} - Final`,      key: `horaFin_${i}`,  width: 15 },
    { header: `Bitácora ${i + 1} - Transporte`, key: `transp_${i}`,   width: 20 },
    { header: `Bitácora ${i + 1} - Total`,      key: `tiempo_${i}`,   width: 15 },
    { header: `Bitácora ${i + 1} - Obs.`,       key: `obs_${i}`,      width: 30 },
  ])).flat();
}

function buildSummaryRow(r, maxEventos) {
  const base = {
    id:            r.id,
    fecha:         r.fecha || "-",
    nombreBarco:   r.nombreBarco || "-",
    producto:      r.producto || "-",
    fechaInicio:   r.fechaInicio || "-",
    fechaCierre:   r.fechaCierre || "-",
    chequero:      r.chequero || "-",
    turnoInicio:   r.turnoInicio || "-",
    turnoFin:      r.turnoFin || "-",
    puntoCarga:    r.puntoCarga || "-",
    puntoDescarga: r.puntoDescarga || "-",
  };
  const eventos = Array.isArray(r.bitacoras) ? r.bitacoras : [];
  for (let i = 0; i < maxEventos; i++) {
    const ev = eventos[i] || {};
    base[`placa_${i}`]   = ev.placa         || "-";
    base[`ticket_${i}`]  = ev.ticket        || "-";
    base[`horaIni_${i}`] = ev.horaInicio    || "-";
    base[`horaFin_${i}`] = ev.horaFinal     || "-";
    base[`transp_${i}`]  = ev.transporte    || "-";
    base[`tiempo_${i}`]  = ev.tiempoTotal   || "-";
    base[`obs_${i}`]     = ev.observaciones || "-";
  }
  return base;
}

function groupBy(arr, keyFn) {
  return arr.reduce((acc, item) => {
    const key = keyFn(item) || "SinBarco";
    (acc[key] ||= []).push(item);
    return acc;
  }, {});
}

async function addHeader(wb, ws) {
  for (let i = 0; i < 4; i++) ws.insertRow(1, []);

  const res = await fetch(LOGO_URL);
  const buf = Buffer.from(await res.arrayBuffer());
  const logoId = wb.addImage({ buffer: buf, extension: "png" });

  ws.mergeCells("B2:D3");
  ws.mergeCells("E2:G2");
  ws.mergeCells("E3:G3");
  ws.mergeCells("H2:I2");
  ws.mergeCells("H3:I3");

  ws.addImage(logoId, {
    tl: { col: 1, row: 1 },
    br: { col: 4, row: 3 },
  });

  ws.getCell("E2").value = "MANEJO Y ALMACENAJE DE CEREALES Y HARINAS";
  ws.getCell("E3").value = "BITÁCORA DE RECEPCIÓN Y TRASLADO DE CEREALES";
  ws.getCell("H2").value = "CÓDIGO: IC-11.10";
  ws.getCell("H3").value = "EDICIÓN: 2";

  ws.getRow(2).height = 30;
  ws.getRow(3).height = 30;

  [2, 3].forEach(rowNum => {
    const row = ws.getRow(rowNum);
    for (let col = 2; col <= 4; col++) {
      row.getCell(col).border = blackBorder;
    }
    for (let col = 5; col <= 9; col++) {
      const cell = row.getCell(col);
      cell.border = blackBorder;
      cell.font = { name: "Arial", size: 10, bold: true };
      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: false,
        shrinkToFit: true,
      };
    }
  });
}

export async function GET(request) {
  try {
    const session = await authorize(request, ALLOWED_ROLES);
    if (session instanceof NextResponse) return session;

    const recepciones = await prisma.recepcionTraslado.findMany({
      orderBy: { fecha: "asc" },
    });

    const maxEventos = recepciones.reduce(
      (m, r) => Math.max(m, (r.bitacoras || []).length),
      0
    );

    const wb = new ExcelJS.Workbook();
    const summary = wb.addWorksheet("Recepciones_Traslados");

    summary.columns = [
      { header: "", key: "pad", width: 3 },
      ...buildFixedColumns(),
      ...buildDynamicColumns(maxEventos),
    ];

    recepciones.forEach(r => summary.addRow(buildSummaryRow(r, maxEventos)));

    await addHeader(wb, summary);

    const headerRow = summary.getRow(5);
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      if (colNumber >= 2) {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
        cell.border = blackBorder;
      }
    });

    summary.eachRow({ includeEmpty: false }, (row, idx) => {
      if (idx <= 5) return;
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if (colNumber >= 2) {
          cell.border = blackBorder;
          cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        }
      });
    });

    const grupos = groupBy(recepciones, r => r.nombreBarco);
    for (const [barco, items] of Object.entries(grupos)) {
      const ws = wb.addWorksheet(barco.substring(0, 31));
      ws.columns = [
        { header: "", key: "pad", width: 3 },
        { header: "ID", key: "id", width: 10 },
        { header: "Fecha", key: "fecha", width: 15 },
        { header: "Fecha Inicio", key: "fechaInicio", width: 15 },
        { header: "Fecha Cierre", key: "fechaCierre", width: 15 },
        { header: "Bitácora #", key: "num", width: 10 },
        { header: "Placa", key: "placa", width: 15 },
        { header: "Ticket", key: "ticket", width: 15 },
        { header: "Inicio", key: "hi", width: 15 },
        { header: "Final", key: "hf", width: 15 },
        { header: "Transporte", key: "transp", width: 20 },
        { header: "Tiempo Total", key: "tt", width: 15 },
        { header: "Obs", key: "obs", width: 30 },
      ];

      items.forEach(r => {
        (r.bitacoras || []).forEach((ev, idx) => {
          ws.addRow({
            id:     r.id,
            fecha:  r.fecha || "-",
            fechaInicio: r.fechaInicio || "-",
            fechaCierre: r.fechaCierre || "-",
            num:    idx + 1,
            placa:  ev.placa || "-",
            ticket: ev.ticket || "-",
            hi:     ev.horaInicio || "-",
            hf:     ev.horaFinal || "-",
            transp: ev.transporte || "-",
            tt:     ev.tiempoTotal || "-",
            obs:    ev.observaciones || "-",
          });
        });
      });

      await addHeader(wb, ws);

      ws.getRow(5).eachCell({ includeEmpty: true }, (cell, colNumber) => {
        if (colNumber >= 2) {
          cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
          cell.alignment = { horizontal: "center", vertical: "middle" };
          cell.border = blackBorder;
        }
      });

      ws.eachRow({ includeEmpty: false }, (row, idx) => {
        if (idx <= 5) return;
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          if (colNumber >= 2) {
            cell.border = blackBorder;
            cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
          }
        });
      });
    }

    const buffer = await wb.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${getFileName()}"`,
      },
    });
  } catch (error) {
    console.error("Error GET /api/v1/recepcion/export-excel:", error);
    const prismaErrorResponse = handlePrismaError(error);
    if (prismaErrorResponse) return prismaErrorResponse.toNextResponse();
    return Status
      .internalError("Ocurrió un error al exportar recepciones/traslados a Excel")
      .toNextResponse();
  }
}