"use client";

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";

// Listas de opciones (ejemplo)
const allTipoCargaBarco = [
  "CEREALES",
  "AZÚCAR CRUDA",
  "CARBÓN",
  "MELAZA",
  "GRASA AMARILLA",
  "YESO",
];
const allSistemaUtilizadoBarco = [
  "UNIDAD DE CARGA",
  "SUCCIONADORA",
  "ALMEJA",
  "CHINGUILLOS",
  "EQUIPO BULHER",
  "ALAMBRE",
];

// Función para obtener fecha/hora
const getFechaHoraGenerada = () => {
  return new Date().toLocaleString("es-SV", { timeZone: "America/El_Salvador" });
};

// Cuántas operaciones por página de bitácoras
const rowsPerPage = 16;

const styles = StyleSheet.create({
  page: {
    fontSize: 10,
    fontFamily: "Helvetica",
    backgroundColor: "#FFFFFF",
    color: "#000000",
    paddingTop: 75,
    paddingBottom: 30,
    paddingHorizontal: 6,
  },
  // Header
  headerTable: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    borderWidth: 1,
    borderColor: "#333333",
    margin: 10,
  },
  headerMainRow: {
    flexDirection: "row",
    height: "100%",
  },
  logoColumn: {
    width: "30%",
    borderRightWidth: 1,
    borderColor: "#333333",
    padding: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 160,
    height: 40,
  },
  titleColumn: {
    width: "40%",
    borderRightWidth: 1,
    borderColor: "#333333",
  },
  titleRow1: {
    flex: 1,
    borderBottomWidth: 1,
    borderColor: "#333333",
    padding: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  titleRow2: {
    flex: 1,
    padding: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  title1Text: {
    fontSize: 8,
    fontWeight: "bold",
    textTransform: "uppercase",
    textAlign: "center",
  },
  title2Text: {
    fontSize: 8,
    textTransform: "uppercase",
    textAlign: "center",
  },
  titleText: {
    fontSize: 11,
    fontWeight: "bold",
    textAlign: "center",
    textTransform: "uppercase",
    lineHeight: 1.2,
  },
  infoColumn: {
    width: "30%",
    flexDirection: "column",
  },
  infoTopRow: {
    flexDirection: "row",
    height: "33.3333%",
    borderBottomWidth: 1,
    borderColor: "#333333",
  },
  infoMiddleRow: {
    flexDirection: "row",
    height: "33.3333%",
    borderBottomWidth: 1,
    borderColor: "#333333",
  },
  infoBottomRow: {
    flexDirection: "row",
    height: "33.3333%",
  },
  infoCellNoBorder: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    padding: 2,
    justifyContent: "flex-start",
  },
  infoCellSmall: { width: "50%" },
  infoCellMedium: { width: "50%" },
  infoCell: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    borderRightWidth: 1,
    borderColor: "#333333",
    padding: 2,
    justifyContent: "flex-start",
  },
  headerLabel: {
    fontSize: 7,
    fontWeight: "bold",
    textTransform: "uppercase",
    marginRight: 1,
    whiteSpace: "nowrap",
  },
  headerValue: {
    fontSize: 7,
    fontWeight: "normal",
    textTransform: "uppercase",
    flexShrink: 1,
  },
  // Footer
  footerContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  footerText: {
    fontSize: 9,
    color: "#000000",
  },
  // Contenido
  whiteBox: {
    backgroundColor: "#FFFFFF",
    marginTop: 0,
    marginBottom: 20,
    padding: 15,
    breakInside: "avoid",
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "bold",
    textTransform: "uppercase",
    marginBottom: 8,
    color: "#000000",
  },
  row: {
    flexDirection: "row",
    marginBottom: 10,
  },
  column: {
    flex: 1,
    marginRight: 10,
  },
  columnLabel: {
    fontSize: 9,
    fontWeight: "bold",
    marginBottom: 2,
    textTransform: "uppercase",
  },
  inputBox: {
    fontSize: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: "#333333",
    minHeight: 18,
    justifyContent: "center",
    flexWrap: "wrap",
  },
  card: {
    borderWidth: 1,
    borderColor: "#333333",
    marginBottom: 10,
    breakInside: "avoid",
  },
  cardHeader: {
    backgroundColor: "#E5E7EB",
    padding: 4,
  },
  cardHeaderText: {
    fontSize: 10,
    fontWeight: "bold",
    textTransform: "uppercase",
    color: "#000000",
    textAlign: "center",
  },
  cardBody: {
    padding: 4,
  },
  checkboxBox: {
    width: 12,
    height: 12,
    borderWidth: 1,
    borderColor: "#333333",
    marginRight: 3,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  checkedBox: { backgroundColor: "#003E9B" },
  checkMark: {
    fontSize: 8,
    textAlign: "center",
    color: "transparent",
  },
  checkedMark: { color: "#FFFFFF" },
  checkboxText: { fontSize: 9 },
  infoCard: {
    borderWidth: 1,
    borderColor: "#333333",
    padding: 4,
    marginBottom: 10,
    breakInside: "avoid",
  },
  tableContainer: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#333333",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F5F5F5",
    borderBottomWidth: 1,
    borderColor: "#333333",
    minHeight: 40,
  },
  tableHeaderCell: {
    fontSize: 9,
    fontWeight: "bold",
    padding: 4,
    textAlign: "center",
    borderRightWidth: 1,
    borderColor: "#333333",
    justifyContent: "center",
    alignItems: "center",
    textTransform: "uppercase",
  },
  tableHeaderCellBdg: { width: "8%" },
  tableHeaderCellTime: { width: "15%" },
  tableHeaderCellMinutos: { width: "12%" },
  tableHeaderCellActividad: {
    width: "50%",
    borderRightWidth: 0,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#333333",
    minHeight: 25,
  },
  tableCell: {
    fontSize: 9,
    padding: 4,
    textAlign: "center",
    borderRightWidth: 1,
    borderColor: "#333333",
    justifyContent: "center",
    alignItems: "center",
  },
  tableCellBdg: { width: "8%" },
  tableCellTime: { width: "15%" },
  tableCellMinutos: { width: "12%" },
  tableCellActividad: {
    width: "50%",
    borderRightWidth: 0,
    textAlign: "left",
    paddingLeft: 6,
  },
  summaryContainer: {
    marginTop: 15,
    padding: 10,
    borderWidth: 1,
    borderColor: "#333333",
    backgroundColor: "#F9F9F9",
  },
  summaryText: {
    fontSize: 10,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 5,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  summaryLabel: {
    fontSize: 9,
    fontWeight: "bold",
  },
  summaryValue: {
    fontSize: 9,
  },
  observationsLabel: {
    fontSize: 9,
    fontWeight: "bold",
    textTransform: "uppercase",
    marginTop: 10,
    marginBottom: 2,
  },
  observationsBox: {
    borderWidth: 1,
    borderColor: "#333333",
    minHeight: 40,
    padding: 5,
    fontSize: 9,
    flexWrap: "wrap",
  },
});

const PDFBitacoraAcumulado = ({ formData }) => {
  // Extraer datos del y operaciones de la respuesta de la API
  const {
    operaciones = [],
    observaciones,
    totalOperaciones,
    fechaArribo,
    fechaAtraque,
    fechaFinOperaciones,
    fechaInicioOperaciones,
    fechaRecibido,
    fechaRegistro,
    horaArribo,
    horaAtraque,
    horaFinOperaciones,
    horaInicioOperaciones,
    horaRecibido,
    muelle,
    sistemaUtilizado,
    tipoCarga,
    vaporBarco
  } = formData;

  const fechaHoraGenerada = getFechaHoraGenerada();

  // Dividir operaciones en páginas de rowsPerPage
  const operationChunks = [];
  for (let i = 0; i < operaciones.length; i += rowsPerPage) {
    operationChunks.push(operaciones.slice(i, i + rowsPerPage));
  }
  // Si no hay operaciones, al menos una página vacía
  if (operationChunks.length === 0) {
    operationChunks.push([]);
  }

  return (
    <Document>
      {/* ================= PRIMERA PÁGINA: INFO ================= */}
      <Page size="LETTER" style={styles.page}>
        {/* Header fijo */}
        <View style={styles.headerTable} fixed>
          <View style={styles.headerMainRow}>
            {/* Logo */}
            <View style={styles.logoColumn}>
              <Image src="/logo.png" style={styles.logo} resizeMode="contain" />
            </View>
            {/* Título */}
            <View style={styles.titleColumn}>
              <View style={styles.titleRow1}>
                <Text style={styles.title1Text}>
                  MANEJO Y ALMACENAJE DE CEREALES Y HARINAS
                </Text>
              </View>
              <View style={styles.titleRow2}>
                <Text style={styles.title1Text}>
                  BITÁCORA DE OPERACIONES EN MUELLE Y A BORDO
                </Text>
              </View>
            </View>
            {/* Info */}
            <View style={styles.infoColumn}>
              {/* Fila 1: Código / Edición */}
              <View style={styles.infoTopRow}>
                <View style={[styles.infoCell, { width: "100%" }]}>
                  <Text style={styles.headerLabel}>
                    CÓDIGO:{" "}
                    <Text style={styles.headerValue}>
                      RP-02.05; RP-03.05;
                    </Text>
                  </Text>
                  <Text style={styles.headerValue}>
                    RP-05.08; RP-05.06; RP-11.01
                  </Text>
                </View>
                <View style={[styles.infoCellNoBorder, styles.infoCellSmall]}>
                  <Text style={styles.headerLabel}>EDICIÓN:</Text>
                  <Text style={styles.headerValue}>2</Text>
                </View>
              </View>
              {/* Fila 2: Vapor/y Muelle */}
              <View style={styles.infoMiddleRow}>
                <View style={[styles.infoCell, { width: "100%" }]}>
                  <Text style={styles.headerLabel}>VAPOR/</Text>
                  <Text style={styles.headerValue}>
                    {vaporBarco || "-"}
                  </Text>
                </View>
                <View style={[styles.infoCellNoBorder, styles.infoCellSmall]}>
                  <Text style={styles.headerLabel}>MUELLE:</Text>
                  <Text style={styles.headerValue}>{muelle || "-"}</Text>
                </View>
              </View>
              {/* Fila 3: Fecha y Hoja No dinámico */}
              <View style={styles.infoBottomRow}>
                <View style={[styles.infoCell, { width: "100%" }]}>
                  <Text style={styles.headerLabel}>FECHA:</Text>
                  <Text style={styles.headerValue}>{fechaRegistro || "-"}</Text>
                </View>
                <View style={[styles.infoCellNoBorder, styles.infoCellSmall]}>
                  <Text style={styles.headerLabel}>HOJA No:</Text>
                  <Text
                    style={styles.headerValue}
                    render={({ pageNumber }) => pageNumber}
                    fixed
                  />
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Footer fijo */}
        <View style={styles.footerContainer} fixed>
          <Text style={styles.footerText}>
            Generado: {fechaHoraGenerada}
          </Text>
        </View>

       {/* Contenido primera página */}
        <View style={styles.whiteBox}>
          <Text style={styles.sectionHeader}>Información del barco</Text>

          <View style={styles.row}>
            <View style={styles.column}>
              <Text style={styles.columnLabel}>MUELLE</Text>
              <View style={styles.inputBox}>
                <Text>{muelle || "-"}</Text>
              </View>
            </View>
            <View style={styles.column}>
              <Text style={styles.columnLabel}>VAPOR/BARCO</Text>
              <View style={styles.inputBox}>
                <Text>{vaporBarco || "-"}</Text>
              </View>
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.column}>
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardHeaderText}>TIPO DE CARGA</Text>
                </View>
                <View style={styles.cardBody}>
                  <View
                    style={{ flexDirection: "row", flexWrap: "wrap" }}
                  >
                    {allTipoCargaBarco.map((tipo) => (
                      <View
                        key={tipo}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          width: "50%",
                          marginBottom: 3,
                        }}
                      >
                        <View
                          style={[
                            styles.checkboxBox,
                            tipoCarga &&
                              tipoCarga.includes(tipo) &&
                              styles.checkedBox,
                          ]}
                        >
                          <Text
                            style={[
                              styles.checkMark,
                              tipoCarga &&
                                tipoCarga.includes(tipo) &&
                                styles.checkedMark,
                            ]}
                          >
                            {tipoCarga &&
                            tipoCarga.includes(tipo)
                              ? "✓"
                              : ""}
                          </Text>
                        </View>
                        <Text style={styles.checkboxText}>{tipo}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            </View>
            <View style={styles.column}>
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardHeaderText}>
                    SISTEMA UTILIZADO
                  </Text>
                </View>
                <View style={styles.cardBody}>
                  <View
                    style={{ flexDirection: "row", flexWrap: "wrap" }}
                  >
                    {allSistemaUtilizadoBarco.map((sistema) => (
                      <View
                        key={sistema}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          width: "50%",
                          marginBottom: 3,
                        }}
                      >
                        <View
                          style={[
                            styles.checkboxBox,
                            sistemaUtilizado &&
                              sistemaUtilizado.includes(sistema) &&
                              styles.checkedBox,
                          ]}
                        >
                          <Text
                            style={[
                              styles.checkMark,
                              sistemaUtilizado &&
                                sistemaUtilizado.includes(sistema) &&
                                styles.checkedMark,
                            ]}
                          >
                            {sistemaUtilizado &&
                            sistemaUtilizado.includes(sistema)
                              ? "✓"
                              : ""}
                          </Text>
                        </View>
                        <Text style={styles.checkboxText}>{sistema}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Fechas/Horas del */}
          <View style={styles.row}>
            <View style={styles.column}>
              <View style={styles.infoCard}>
                <Text style={styles.cardHeaderText}>ARRIBO</Text>
                <View style={styles.row}>
                  <View style={styles.column}>
                    <Text style={styles.columnLabel}>Fecha Arribo</Text>
                    <View style={styles.inputBox}>
                      <Text>{fechaArribo || "-"}</Text>
                    </View>
                  </View>
                  <View style={styles.column}>
                    <Text style={styles.columnLabel}>Hora Arribo</Text>
                    <View style={styles.inputBox}>
                      <Text>{horaArribo || "-"}</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
            <View style={styles.column}>
              <View style={styles.infoCard}>
                <Text style={styles.cardHeaderText}>ATRAQUE</Text>
                <View style={styles.row}>
                  <View style={styles.column}>
                    <Text style={styles.columnLabel}>Fecha Atraque</Text>
                    <View style={styles.inputBox}>
                      <Text>{fechaAtraque || "-"}</Text>
                    </View>
                  </View>
                  <View style={styles.column}>
                    <Text style={styles.columnLabel}>Hora Atraque</Text>
                    <View style={styles.inputBox}>
                      <Text>{horaAtraque || "-"}</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.column}>
              <View style={styles.infoCard}>
                <Text style={styles.cardHeaderText}>RECIBIDO</Text>
                <View style={styles.row}>
                  <View style={styles.column}>
                    <Text style={styles.columnLabel}>Fecha Recibido</Text>
                    <View style={styles.inputBox}>
                      <Text>{fechaRecibido || "-"}</Text>
                    </View>
                  </View>
                  <View style={styles.column}>
                    <Text style={styles.columnLabel}>Hora Recibido</Text>
                    <View style={styles.inputBox}>
                      <Text>{horaRecibido || "-"}</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
            <View style={styles.column}>
              <View style={styles.infoCard}>
                <Text style={styles.cardHeaderText}>
                  INICIO OPERACIONES
                </Text>
                <View style={styles.row}>
                  <View style={styles.column}>
                    <Text style={styles.columnLabel}>Fecha Inicio</Text>
                    <View style={styles.inputBox}>
                      <Text>{fechaInicioOperaciones || "-"}</Text>
                    </View>
                  </View>
                  <View style={styles.column}>
                    <Text style={styles.columnLabel}>Hora Inicio</Text>
                    <View style={styles.inputBox}>
                      <Text>{horaInicioOperaciones || "-"}</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.column}>
              <View style={styles.infoCard}>
                <Text style={styles.cardHeaderText}>
                  FIN OPERACIONES
                </Text>
                <View style={styles.row}>
                  <View style={styles.column}>
                    <Text style={styles.columnLabel}>Fecha Fin</Text>
                    <View style={styles.inputBox}>
                      <Text>{fechaFinOperaciones || "-"}</Text>
                    </View>
                  </View>
                  <View style={styles.column}>
                    <Text style={styles.columnLabel}>Hora Fin</Text>
                    <View style={styles.inputBox}>
                      <Text>{horaFinOperaciones || "-"}</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.column}>
              <View style={styles.infoCard}>
                <Text style={styles.cardHeaderText}>
                  TOTAL OPERACIONES
                </Text>
                <View style={styles.row}>
                  <View style={styles.column}>
                    <View style={styles.inputBox}>
                      <Text>{totalOperaciones || "-"}</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          </View>

        </View>
      </Page>

      {/* ================= PÁGINAS DINÁMICAS DE OPERACIONES ================= */}
      {operationChunks.map((opsChunk, idx) => (
        <Page size="LETTER" style={styles.page} key={`operaciones-page-${idx + 2}`}>
          {/* Header fijo */}
          <View style={styles.headerTable} fixed>
            <View style={styles.headerMainRow}>
              {/* Logo */}
              <View style={styles.logoColumn}>
                <Image src="/logo.png" style={styles.logo} resizeMode="contain" />
              </View>
              {/* Título */}
              <View style={styles.titleColumn}>
                <View style={styles.titleRow1}>
                  <Text style={styles.title1Text}>
                    MANEJO Y ALMACENAJE DE CEREALES Y HARINAS
                  </Text>
                </View>
                <View style={styles.titleRow2}>
                  <Text style={styles.title1Text}>
                    BITÁCORA DE OPERACIONES EN MUELLE Y A BORDO
                  </Text>
                </View>
              </View>
              {/* Info */}
              <View style={styles.infoColumn}>
                {/* Fila 1: Código / Edición */}
                <View style={styles.infoTopRow}>
                  <View style={[styles.infoCell, { width: "100%" }]}>
                    <Text style={styles.headerLabel}>
                      CÓDIGO:{" "}
                      <Text style={styles.headerValue}>
                        RP-02.05; RP-03.05;
                      </Text>
                    </Text>
                    <Text style={styles.headerValue}>
                      RP-05.08; RP-05.06; RP-11.01
                    </Text>
                  </View>
                  <View style={[styles.infoCellNoBorder, styles.infoCellSmall]}>
                    <Text style={styles.headerLabel}>EDICIÓN:</Text>
                    <Text style={styles.headerValue}>2</Text>
                  </View>
                </View>
                {/* Fila 2: Vapor/y Muelle */}
                <View style={styles.infoMiddleRow}>
                  <View style={[styles.infoCell, { width: "100%" }]}>
                    <Text style={styles.headerLabel}>VAPOR/</Text>
                    <Text style={styles.headerValue}>
                      {vaporBarco || "-"}
                    </Text>
                  </View>
                  <View style={[styles.infoCellNoBorder, styles.infoCellSmall]}>
                    <Text style={styles.headerLabel}>MUELLE:</Text>
                    <Text style={styles.headerValue}>{muelle || "-"}</Text>
                  </View>
                </View>
                {/* Fila 3: Fecha y Hoja No dinámico */}
                <View style={styles.infoBottomRow}>
                  <View style={[styles.infoCell, { width: "100%" }]}>
                    <Text style={styles.headerLabel}>FECHA:</Text>
                    <Text style={styles.headerValue}>
                      {fechaRegistro || "-"}
                    </Text>
                  </View>
                  <View style={[styles.infoCellNoBorder, styles.infoCellSmall]}>
                    <Text style={styles.headerLabel}>HOJA No:</Text>
                    <Text
                      style={styles.headerValue}
                      render={({ pageNumber }) => pageNumber}
                      fixed
                    />
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Footer fijo */}
          <View style={styles.footerContainer} fixed>
            <Text style={styles.footerText}>
              Generado: {fechaHoraGenerada}
            </Text>
          </View>

          {/* Contenido de la página de operaciones */}
          <View style={styles.whiteBox}>
            {/* Tabla de operaciones */}
            <View style={styles.tableContainer}>
              <View style={styles.tableHeader}>
                <View style={[styles.tableHeaderCell, styles.tableHeaderCellBdg]}>
                  <Text>BDG{"\n"}TQ</Text>
                </View>
                <View style={[styles.tableHeaderCell, styles.tableHeaderCellTime]}>
                  <Text>INICIO</Text>
                </View>
                <View style={[styles.tableHeaderCell, styles.tableHeaderCellTime]}>
                  <Text>FINAL</Text>
                </View>
                <View style={[styles.tableHeaderCell, styles.tableHeaderCellMinutos]}>
                  <Text>MINUTOS</Text>
                </View>
                <View style={[styles.tableHeaderCell, styles.tableHeaderCellActividad]}>
                  <Text>DESCRIPCIÓN DE LA ACTIVIDAD O DEMORA</Text>
                </View>
              </View>
              {opsChunk.map((op, rowIdx) => (
                <View key={rowIdx} style={styles.tableRow}>
                  <View style={[styles.tableCell, styles.tableCellBdg]}>
                    <Text>{op.bodega || ""}</Text>
                  </View>
                  <View style={[styles.tableCell, styles.tableCellTime]}>
                    <Text>{op.inicio || ""}</Text>
                  </View>
                  <View style={[styles.tableCell, styles.tableCellTime]}>
                    <Text>{op.final || ""}</Text>
                  </View>
                  <View style={[styles.tableCell, styles.tableCellMinutos]}>
                    <Text>{op.minutos || ""}</Text>
                  </View>
                  <View style={[styles.tableCell, styles.tableCellActividad]}>
                    <Text>{op.actividad || ""}</Text>
                  </View>
                </View>
              ))}
              {/* Filas vacías para completar la página */}
              {Array.from({
                length: rowsPerPage - opsChunk.length,
              }).map((_, i) => (
                <View key={`empty-${i}`} style={styles.tableRow}>
                  <View
                    style={[styles.tableCell, styles.tableCellBdg]}
                  >
                    <Text></Text>
                  </View>
                  <View
                    style={[styles.tableCell, styles.tableCellTime]}
                  >
                    <Text></Text>
                  </View>
                  <View
                    style={[styles.tableCell, styles.tableCellTime]}
                  >
                    <Text></Text>
                  </View>
                  <View
                    style={[styles.tableCell, styles.tableCellMinutos]}
                  >
                    <Text></Text>
                  </View>
                  <View
                    style={[
                      styles.tableCell,
                      styles.tableCellActividad,
                    ]}
                  >
                    <Text></Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Observaciones (solo en la última página de bitácoras) */}
            {idx === operationChunks.length - 1 && (
              <>
                <Text style={styles.observationsLabel}>
                  Observaciones
                </Text>
                <View style={styles.observationsBox}>
                  <Text>{observaciones || ""}</Text>
                </View>
              </>
            )}
          </View>
        </Page>
      ))}
    </Document>
  );
};

export default PDFBitacoraAcumulado;