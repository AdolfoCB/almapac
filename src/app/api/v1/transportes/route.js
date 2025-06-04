// File: /app/api/transportes/route.js

import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { authorize } from "@/lib/sessionRoleValidator";

export const config = {
  api: {
    bodyParser: false,
  },
};

const ALLOWED_ROLES = [1]; // solo admin

export async function POST(request) {
  // autorización
  const session = await authorize(request, ALLOWED_ROLES);
  if (session instanceof NextResponse) return session;

  try {
    // 1) Extraer el FormData
    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Falta el archivo .xlsx" }, { status: 400 });
    }

    // 2) Leer el workbook
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    // 3) Validar que en cada hoja la fila 2 tenga A o B
    for (const worksheet of workbook.worksheets) {
      const row2 = worksheet.getRow(2);
      const nombre2 = row2.getCell(1).text.trim();
      const placa2  = row2.getCell(2).text.trim();
      if (!nombre2 && !placa2) {
        return NextResponse.json(
          { error: `Hoja "${worksheet.name}": la fila 2 debe tener informacion de motorista y camion` },
          { status: 400 }
        );
      }
    }

    // 4) Si todo OK, devolvemos solo las filas a partir de la 2 donde A o B no estén vacías
    const sheets = workbook.worksheets.map((worksheet) => {
      const rows = [];
      for (let i = 2; i <= worksheet.rowCount; i++) {
        const row = worksheet.getRow(i);
        const nombre = row.getCell(1).text.trim();
        const placa  = row.getCell(2).text.trim();
        if (nombre || placa) {
          rows.push({ nombre, placa });
        }
      }
      return {
        sheetName: worksheet.name,
        rows,
      };
    });

    return NextResponse.json({ sheets });
  } catch (err) {
    console.error("Error interno al procesar Excel:", err);
    return NextResponse.json(
      { error: "Error interno al procesar Excel" },
      { status: 500 }
    );
  }
}