// File: /app/api/v1/equipos/export-excel/route.js

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import ExcelJS from "exceljs";
import { authorize } from "@/lib/sessionRoleValidator";
import { Status, handlePrismaError } from "@/lib/status";

// Solo ADMINISTRADOR (1) y SUPERVISOR MANTENIMIENTO (6)
const ALLOWED_ROLES = [1, 6];

// URL del logo para el encabezado
const LOGO_URL =
  "https://res.cloudinary.com/dw7txgvbh/image/upload/v1744046207/almapac-logo.png";

// Borde fino negro para todas las celdas
const blackBorder = {
  top:    { style: "thin", color: { argb: "FF000000" } },
  left:   { style: "thin", color: { argb: "FF000000" } },
  bottom: { style: "thin", color: { argb: "FF000000" } },
  right:  { style: "thin", color: { argb: "FF000000" } },
};

/**
 * Inserta un header gráfico estilo bitácoras
 */
async function addHeader(workbook, sheet) {
  // Insertar 4 filas vacías al inicio
  for (let i = 0; i < 4; i++) sheet.insertRow(1, []);
  
  // Cargar logo
  const res = await fetch(LOGO_URL);
  const buf = Buffer.from(await res.arrayBuffer());
  const logoId = workbook.addImage({ buffer: buf, extension: "png" });

  // Fusionar celdas para el diseño
  sheet.mergeCells("B2:D3");
  sheet.mergeCells("E2:G3"); 
  sheet.mergeCells("H2:I2");
  sheet.mergeCells("H3:I3");

  // Añadir imagen del logo
  sheet.addImage(logoId, { 
    tl: { col: 1, row: 1 }, 
    br: { col: 4, row: 3 } 
  });

  // Textos del header
  sheet.getCell("E2").value = "LISTADO DE ACTIVIDADES AL INICIO DE LAS OPERACIONES CON EQUIPO FRONTAL";
  sheet.getCell("H2").value = "CÓDIGO: INS-11.01";
  sheet.getCell("H3").value = "EDICIÓN: 1";

  // Aplicar estilos al header
  [2, 3].forEach(rn => {
    const row = sheet.getRow(rn);
    row.height = 30;
    for (let c = 2; c <= 9; c++) {
      const cell = row.getCell(c);
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

/**
 * Formatea campos de array/JSON para mostrar en Excel
 */
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

/**
 * Genera nombre del archivo con timestamp
 */
function getFileName() {
  const now = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `Equipos ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate()
  )} ${pad(now.getHours())}-${pad(now.getMinutes())}.xlsx`;
}

export async function GET(request) {
  // Validación de sesión y roles
  const session = await authorize(request, ALLOWED_ROLES);
  if (session instanceof NextResponse) return session;

  try {
    // Obtener parámetros de filtrado por fecha (opcional)
    const { searchParams } = new URL(request.url);
    const fechaInicio = searchParams.get("fechaInicio");
    const fechaFin = searchParams.get("fechaFinal");

    // Construir filtros
    const where = fechaInicio && fechaFin
      ? { fecha: { gte: fechaInicio, lte: fechaFin } }
      : {};

    // Obtener equipos
    const equipos = await prisma.equipo.findMany({
      where,
      orderBy: { fecha: "asc" }
    });

    // Crear workbook
    const workbook = new ExcelJS.Workbook();

    // ========== HOJA RESUMEN ==========
    const summary = workbook.addWorksheet("Equipos");
    
    // Definir columnas con padding inicial
    summary.columns = [
      { header: "",                 key: "pad",             width: 3 },
      { header: "ID",              key: "ID",              width: 8 },
      { header: "Equipo",          key: "Equipo",          width: 20 },
      { header: "Horómetro",       key: "Horometro",       width: 15 },
      { header: "Operador",        key: "Operador",        width: 20 },
      { header: "Fecha",           key: "Fecha",           width: 15 },
      { header: "Hora Inicio",     key: "Hora Inicio",     width: 15 },
      { header: "Hora Fin",        key: "Hora Fin",        width: 15 },
      { header: "Tiempo Total",    key: "Tiempo Total",    width: 15 },
      { header: "Inicio Turno",    key: "Inicio Turno",    width: 15 },
      { header: "Termina Turno",   key: "Termina Turno",   width: 15 },
      { header: "Recomendaciones", key: "Recomendaciones", width: 30 },
      { header: "Total Inspecciones", key: "Total Inspecciones", width: 18 },
      { header: "Inspecciones OK", key: "Inspecciones OK", width: 18 },
      { header: "Con Observaciones", key: "Con Observaciones", width: 20 },
    ];

    // Llenar datos del resumen
    equipos.forEach(equipo => {
      const inspecciones = Array.isArray(equipo.inspecciones) ? equipo.inspecciones : [];
      const totalInspecciones = inspecciones.length;
      const inspeccionesOK = inspecciones.filter(i => i.cumple).length;
      const conObservaciones = inspecciones.filter(i => i.observaciones && i.observaciones.trim()).length;

      summary.addRow({
        pad: "",
        ID: equipo.id,
        Equipo: equipo.equipo || "-",
        Horometro: equipo.horometro || "-",
        Operador: equipo.operador || "-",
        Fecha: equipo.fecha || "-",
        "Hora Inicio": equipo.hora || "-",
        "Hora Fin": equipo.horaFin || "-",
        "Tiempo Total": equipo.tiempoTotal || "-",
        "Inicio Turno": equipo.turnoInicio || "-",
        "Termina Turno": equipo.turnoFin || "-",
        Recomendaciones: equipo.recomendaciones || "-",
        "Total Inspecciones": totalInspecciones,
        "Inspecciones OK": inspeccionesOK,
        "Con Observaciones": conObservaciones,
      });
    });

    // Añadir header y estilos a la hoja resumen
    await addHeader(workbook, summary);
    
    // Estilizar fila de encabezados (fila 5)
    const headerRow = summary.getRow(5);
    headerRow.height = 20;
    headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
      if (col >= 2) {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.border = blackBorder;
      }
    });

    // Estilizar filas de datos
    summary.eachRow({ includeEmpty: false }, (row, idx) => {
      if (idx <= 5) return; // Saltar header y filas de encabezado
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        if (col >= 2) {
          cell.border = blackBorder;
          cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        }
      });
    });

    // ========== HOJAS POR EQUIPO ==========
    const grouped = equipos.reduce((acc, equipo) => {
      const key = equipo.equipo || "SinEquipo";
      (acc[key] ||= []).push(equipo);
      return acc;
    }, {});

    for (const [equipoName, items] of Object.entries(grouped)) {
      const sheetName = equipoName.substring(0, 31); // Límite de caracteres para nombre de hoja
      const ws = workbook.addWorksheet(sheetName);
      
      // Columnas para la hoja de equipo específico
      ws.columns = [
        { header: "",             key: "pad",         width: 3 },
        { header: "Equipo ID",    key: "equipoId",    width: 12 },
        { header: "Fecha",        key: "fecha",       width: 15 },
        { header: "Operador",     key: "operador",    width: 20 },
        { header: "Horómetro",    key: "horometro",   width: 15 },
        { header: "Turno",        key: "turno",       width: 20 },
        { header: "Parte Evaluada", key: "parte",     width: 30 },
        { header: "Cumple",       key: "cumple",      width: 10 },
        { header: "Observaciones", key: "observaciones", width: 40 },
      ];

      // Llenar datos de inspecciones por equipo
      items.forEach(equipo => {
        const inspecciones = Array.isArray(equipo.inspecciones) ? equipo.inspecciones : [];
        const turno = `${equipo.turnoInicio || "-"} - ${equipo.turnoFin || "-"}`;

        if (inspecciones.length > 0) {
          inspecciones.forEach(inspeccion => {
            ws.addRow({
              pad: "",
              equipoId: equipo.id,
              fecha: equipo.fecha || "-",
              operador: equipo.operador || "-",
              horometro: equipo.horometro || "-",
              turno: turno,
              parte: inspeccion.titulo || "-",
              cumple: inspeccion.cumple ? "SI" : "NO",
              observaciones: inspeccion.observaciones || "-",
            });
          });
        } else {
          // Si no hay inspecciones, mostrar al menos los datos básicos
          ws.addRow({
            pad: "",
            equipoId: equipo.id,
            fecha: equipo.fecha || "-",
            operador: equipo.operador || "-",
            horometro: equipo.horometro || "-",
            turno: turno,
            parte: "Sin inspecciones",
            cumple: "-",
            observaciones: equipo.recomendaciones || "-",
          });
        }
      });

      // Añadir header y estilos a la hoja de equipo
      await addHeader(workbook, ws);
      
      // Estilizar fila de encabezados
      const headerRow2 = ws.getRow(5);
      headerRow2.eachCell({ includeEmpty: true }, (cell, col) => {
        if (col >= 2) {
          cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
          cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
          cell.border = blackBorder;
        }
      });

      // Estilizar filas de datos
      ws.eachRow({ includeEmpty: false }, (row, idx) => {
        if (idx <= 5) return;
        row.eachCell({ includeEmpty: true }, (cell, col) => {
          if (col >= 2) {
            cell.border = blackBorder;
            cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
          }
        });
      });
    }

    // ========== GENERAR Y ENVIAR ARCHIVO ==========
    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${getFileName()}"`,
      },
    });

  } catch (error) {
    console.error("Error GET /api/v1/equipos/export-excel:", error);
    const prismaErrorResponse = handlePrismaError(error);
    if (prismaErrorResponse) return prismaErrorResponse.toNextResponse();
    return Status
      .internalError("Ocurrió un error al exportar equipos a Excel")
      .toNextResponse();
  }
}