import { NextResponse } from "next/server"; 
import prisma from "@/lib/prisma";
import ExcelJS from "exceljs";
import { authorize } from "@/lib/sessionRoleValidator";
import { Status, handlePrismaError } from "@/lib/status";

const ALLOWED_ROLES = [1, 4];

const LOGO_URL =
  "https://res.cloudinary.com/dw7txgvbh/image/upload/v1744046207/almapac-logo.png";

const blackBorder = {
  top:    { style: "thin", color: { argb: "FF000000" } },
  left:   { style: "thin", color: { argb: "FF000000" } },
  bottom: { style: "thin", color: { argb: "FF000000" } },
  right:  { style: "thin", color: { argb: "FF000000" } },
};

async function addHeader(workbook, sheet) {
  for (let i = 0; i < 4; i++) sheet.insertRow(1, []);
  const res = await fetch(LOGO_URL);
  const buf = Buffer.from(await res.arrayBuffer());
  const logoId = workbook.addImage({ buffer: buf, extension: "png" });

  sheet.mergeCells("B2:D3");
  sheet.mergeCells("E2:G2");
  sheet.mergeCells("E3:G3");
  sheet.mergeCells("H2:I2");
  sheet.mergeCells("H3:I3");
  sheet.addImage(logoId, { tl: { col: 1, row: 1 }, br: { col: 4, row: 3 } });

  sheet.getCell("E2").value = "MANEJO Y ALMACENAJE DE CEREALES Y HARINAS";
  sheet.getCell("E3").value = "BITÁCORA DE OPERACIONES EN MUELLE Y ABORDO";
  sheet.getCell("H2").value =
    "CÓDIGO: RP-02.05; RP-03.05; RP-05.08; RP-05.06; RP-11.01";
  sheet.getCell("H3").value = "EDICIÓN: 2";

  sheet.getRow(2).height = 30;
  sheet.getRow(3).height = 30;

  [2, 3].forEach(rowNum => {
    const row = sheet.getRow(rowNum);
    for (let col = 2; col <= 4; col++) {
      row.getCell(col).border = blackBorder;
    }
    for (let col = 5; col <= 9; col++) {
      const cell = row.getCell(col);
      cell.border = blackBorder;
      cell.border = blackBorder;
      cell.font = { name: "Arial", size: 10, bold: true };
      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
    }
  });
}

function formatArrayField(field) {
  if (Array.isArray(field)) return field.join(", ");
  if (typeof field === "string") {
    try {
      const parsed = JSON.parse(field);
      if (Array.isArray(parsed)) return parsed.join(", ");
    } catch {}
    return field.replace(/\\|\[|\]|"/g, "") || "-";
  }
  return "-";
}

function getFileName() {
  const now = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `Bitacoras ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate()
  )} ${pad(now.getHours())}-${pad(now.getMinutes())}.xlsx`;
}

export async function GET(request) {
  const session = await authorize(request, ALLOWED_ROLES);
  if (session instanceof NextResponse) return session;

  try {
    const { searchParams } = new URL(request.url);
    const fechaInicio = searchParams.get("fechaInicio");
    const fechaFin = searchParams.get("fechaFinal");

    const where = fechaInicio && fechaFin
      ? { fecha: { gte: fechaInicio, lte: fechaFin }, eliminado: false }
      : { eliminado: false };

    const bitacoras = await prisma.bitacoraBarco.findMany({
      where,
      orderBy: { fecha: "asc" },
      include: {
        barco: true,
      },
    });

    const workbook = new ExcelJS.Workbook();

    const summary = workbook.addWorksheet("Bitacoras");
    summary.columns = [
      { header: "",               key: "pad",               width: 3 },
      { header: "ID",             key: "ID",                width: 8 },
      { header: "Fecha",          key: "Fecha",             width: 15 },
      { header: "Fecha Inicio",   key: "Fecha Inicio",      width: 18 },
      { header: "Fecha Cierre",   key: "Fecha Cierre",      width: 18 },
      { header: "Muellero",       key: "Muellero",          width: 20 },
      { header: "Inicio Turno",   key: "Inicio Turno",      width: 15 },
      { header: "Termina Turno",  key: "Termina Turno",     width: 15 },
      { header: "Observaciones",  key: "Observaciones",     width: 30 },
      { header: "Muelle",         key: "Muelle",            width: 15 },
      { header: "Vapor Barco",    key: "Vapor Barco",       width: 20 },
      { header: "Fecha Arribo",   key: "Fecha Arribo",      width: 15 },
      { header: "Hora Arribo",    key: "Hora Arribo",       width: 12 },
      { header: "Fecha Atraque",  key: "Fecha Atraque",     width: 15 },
      { header: "Hora Atraque",   key: "Hora Atraque",      width: 12 },
      { header: "Fecha Recibido", key: "Fecha Recibido",    width: 15 },
      { header: "Hora Recibido",  key: "Hora Recibido",     width: 12 },
      { header: "Inicio Oper.",   key: "Inicio Oper.",      width: 18 },
      { header: "Hora Inicio Op.",key: "Hora Inicio Op.",   width: 18 },
      { header: "Fin Oper.",      key: "Fin Oper.",         width: 18 },
      { header: "Hora Fin Op.",   key: "Hora Fin Op.",      width: 18 },
      { header: "Tipo Carga",     key: "Tipo Carga",        width: 25 },
      { header: "Sistema Utiliz.",key: "Sistema Utiliz.",   width: 25 },
    ];

    bitacoras.forEach(b => {
      const barco = b.barco || {};
      summary.addRow({
        pad:                "",
        ID:                 b.id,
        "Fecha":             b.fecha || "-",
        "Fecha Inicio":      b.fechaInicio || "-",
        "Fecha Cierre":      b.fechaCierre || "-",
        "Muellero":          b.muellero || "-",
        "Inicio Turno":      b.turnoInicio || "-",
        "Termina Turno":     b.turnoFin || "-",
        Observaciones:       b.observaciones || "-",
        Muelle:              barco.muelle || "-",
        "Vapor Barco":       barco.vaporBarco || "-",
        "Fecha Arribo":      barco.fechaArribo || "-",
        "Hora Arribo":       barco.horaArribo || "-",
        "Fecha Atraque":     barco.fechaAtraque || "-",
        "Hora Atraque":      barco.horaAtraque || "-",
        "Fecha Recibido":    barco.fechaRecibido || "-",
        "Hora Recibido":     barco.horaRecibido || "-",
        "Inicio Oper.":      barco.fechaInicioOperaciones || "-",
        "Hora Inicio Op.":   barco.horaInicioOperaciones || "-",
        "Fin Oper.":         barco.fechaFinOperaciones || "-",
        "Hora Fin Op.":      barco.horaFinOperaciones || "-",
        "Tipo Carga":        formatArrayField(barco.tipoCarga),
        "Sistema Utiliz.":   formatArrayField(barco.sistemaUtilizado),
      });
    });

    await addHeader(workbook, summary);

    const hdr = summary.getRow(5);
    hdr.height = 20;
    hdr.eachCell({ includeEmpty: true }, (cell, col) => {
      if (col >= 2) {
        cell.font      = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.border    = blackBorder;
      }
    });
    summary.eachRow({ includeEmpty: false }, (row, idx) => {
      if (idx <= 5) return;
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        if (col >= 2) {
          cell.border    = blackBorder;
          cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        }
      });
    });

    const grouped = bitacoras.reduce((acc, b) => {
      const key = b.barco?.vaporBarco || "SinBarco";
      (acc[key] ||= []).push(b);
      return acc;
    }, {});

    for (const [name, items] of Object.entries(grouped)) {
      const ws = workbook.addWorksheet(name.substring(0, 31));
      ws.columns = [
        { header: "",           key: "pad",     width: 3 },
        { header: "Bitácora ID",key: "bitId",   width: 12 },
        { header: "Fecha",      key: "fecha",   width: 12 },
        { header: "Muelle",     key: "muelle",  width: 12 },
        { header: "Vapor Barco",key: "vapor",   width: 20 },
        { header: "Muellero",   key: "muellero",width: 20 },
        { header: "Turno",      key: "turno",   width: 18 },
        { header: "Bodega",     key: "bodega",  width: 12 },
        { header: "Inicio",     key: "inicio",  width: 15 },
        { header: "Final",      key: "final",   width: 15 },
        { header: "Minutos",    key: "minutos", width: 10 },
        { header: "Actividad",  key: "actividad",width: 30 },
      ];

      items.forEach(b => {
        const operaciones = Array.isArray(b.operaciones) ? b.operaciones : [];
        const turno = `${b.turnoInicio || "-"} - ${b.turnoFin || "-"}`;
        const barco = b.barco || {};

        operaciones.forEach(op => {
          ws.addRow({
            pad:       "",
            bitId:     b.id,
            fecha:     b.fecha || "-",
            muelle:    barco.muelle || "-",
            vapor:     barco.vaporBarco || "-",
            muellero:  b.muellero || "-",
            turno:     turno,
            bodega:    op.bodega || "-",
            inicio:    op.inicio || "-",
            final:     op.final || "-",
            minutos:   op.minutos || "-",
            actividad: op.actividad || "-",
          });
        });
      });

      await addHeader(workbook, ws);

      const hdr2 = ws.getRow(5);
      hdr2.eachCell({ includeEmpty: true }, (cell, col) => {
        if (col >= 2) {
          cell.font      = { bold: true, color: { argb: "FFFFFFFF" } };
          cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
          cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
          cell.border    = blackBorder;
        }
      });
      ws.eachRow({ includeEmpty: false }, (row, idx) => {
        if (idx <= 5) return;
        row.eachCell({ includeEmpty: true }, (cell, col) => {
          if (col >= 2) {
            cell.border    = blackBorder;
            cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
          }
        });
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${getFileName()}"`,
      },
    });
  } catch (error) {
    console.error("Error GET /api/v1/bitacoras/export-excel:", error);
    const prismaErrorResponse = handlePrismaError(error);
    if (prismaErrorResponse) return prismaErrorResponse.toNextResponse();
    return Status.internalError("Ocurrió un error al exportar las bitácoras a Excel").toNextResponse();
  }
}