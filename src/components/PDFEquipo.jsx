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

// Obtiene fecha/hora en zona America/El_Salvador
const getFechaHoraGenerada = () =>
  new Date().toLocaleString("es-SV", { timeZone: "America/El_Salvador" });

// Límite de inspecciones por página
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
  headerTable: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    borderWidth: 1,
    borderColor: "#333333",
    margin: 10,
    backgroundColor: "#FFFFFF",
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
    width: "55%",
    borderRightWidth: 1,
    borderColor: "#333333",
  },
  titleRow1: {
    flex: 1,
    borderColor: "#333333",
    padding: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  titleText1: {
    fontSize: 11,
    fontWeight: "bold",
    textTransform: "uppercase",
    textAlign: "center",
  },
  infoColumn: {
    width: "15%",
    flexDirection: "column",
  },
  infoRow: {
    flex: 1,
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#333333",
    alignItems: "center",
    padding: 2,
  },
  infoLastRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 2,
  },
  infoLabel: {
    fontSize: 7,
    fontWeight: "bold",
    textTransform: "uppercase",
    marginRight: 4,
  },
  infoValue: {
    fontSize: 7,
    textTransform: "uppercase",
  },
  footerContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  footerText: {
    fontSize: 9,
  },
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
    textTransform: "uppercase",
    marginBottom: 2,
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
  },
  thNumber: {
    width: "8%",
    fontSize: 9,
    fontWeight: "bold",
    padding: 4,
    textAlign: "center",
    borderRightWidth: 1,
    borderColor: "#333333",
    textTransform: "uppercase",
  },
  thTitle: {
    flex: 1,
    fontSize: 9,
    fontWeight: "bold",
    padding: 4,
    textAlign: "center",
    borderRightWidth: 1,
    borderColor: "#333333",
    textTransform: "uppercase",
  },
  thCumple: {
    width: "12%",
    fontSize: 9,
    fontWeight: "bold",
    padding: 4,
    textAlign: "center",
    borderRightWidth: 1,
    borderColor: "#333333",
    textTransform: "uppercase",
  },
  thObs: {
    width: "30%",
    fontSize: 9,
    fontWeight: "bold",
    padding: 4,
    textAlign: "center",
    borderRightWidth: 0,
    borderColor: "#333333",
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#333333",
    minHeight: 20,
  },
  tdNumber: {
    width: "8%",
    fontSize: 9,
    padding: 4,
    textAlign: "center",
    borderRightWidth: 1,
    borderColor: "#333333",
  },
  tdTitle: {
    flex: 1,
    fontSize: 9,
    padding: 4,
    textAlign: "left",
    borderRightWidth: 1,
    borderColor: "#333333",
  },
  tdCumple: {
    width: "12%",
    fontSize: 9,
    padding: 4,
    textAlign: "center",
    borderRightWidth: 1,
    borderColor: "#333333",
  },
  tdObs: {
    width: "30%",
    fontSize: 9,
    padding: 4,
    textAlign: "justify",
    borderRightWidth: 0,
    borderColor: "#333333",
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

const PDFEquipo = ({ formData }) => {
  const {
    equipo,
    horometro,
    operador,
    fecha,
    hora,
    horaFin,
    tiempoTotal,
    turnoInicio,
    turnoFin,
    recomendaciones,
    inspecciones = [],
  } = formData;

  const generadoEn = getFechaHoraGenerada();

  // Paginación de inspecciones
  const chunks = [];
  for (let i = 0; i < inspecciones.length; i += rowsPerPage) {
    chunks.push(inspecciones.slice(i, i + rowsPerPage));
  }
  if (chunks.length === 0) chunks.push([]);

  return (
    <Document>
      {chunks.map((chunk, pageIndex) => (
        <Page key={pageIndex} size="LETTER" style={styles.page}>
          {/* Header fijo */}
          <View style={styles.headerTable} fixed>
            <View style={styles.headerMainRow}>
              <View style={styles.logoColumn}>
                <Image
                  src="/logo.png"
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.titleColumn}>
                <View style={styles.titleRow1}>
                  <Text style={styles.titleText1}>
                    LISTADO DE ACTIVIDADES AL INICIO DE LAS{"\n"}OPERACIONES CON EQUIPO FRONTAL
                  </Text>
                </View>
              </View>
              <View style={styles.infoColumn}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>CÓDIGO:</Text>
                  <Text style={styles.infoValue}>INS-11.01</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>EDICIÓN:</Text>
                  <Text style={styles.infoValue}>1</Text>
                </View>
                <View style={styles.infoLastRow}>
                  <Text style={styles.infoLabel}>HOJA No:</Text>
                  <Text
                    style={styles.infoValue}
                    render={({ pageNumber }) => pageNumber}
                    fixed
                  />
                </View>
              </View>
            </View>
          </View>

          {/* Footer fijo */}
          <View style={styles.footerContainer} fixed>
            <Text style={styles.footerText}>Generado: {generadoEn}</Text>
          </View>

          {/* Información del Equipo */}
          <View style={styles.whiteBox}>
            <Text style={styles.sectionHeader}>Información del Equipo</Text>
            <View style={styles.row}>
              <View style={styles.column}>
                <Text style={styles.columnLabel}>Equipo</Text>
                <View style={styles.inputBox}>
                  <Text>{equipo || "-"}</Text>
                </View>
              </View>
              <View style={styles.column}>
                <Text style={styles.columnLabel}>Horómetro</Text>
                <View style={styles.inputBox}>
                  <Text>{horometro || "-"}</Text>
                </View>
              </View>
              <View style={styles.column}>
                <Text style={styles.columnLabel}>Fecha / Hora</Text>
                <View style={styles.inputBox}>
                  <Text>
                    {fecha || "-"} {hora || "-"}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.column}>
                <Text style={styles.columnLabel}>Termina Inspección</Text>
                <View style={styles.inputBox}>
                  <Text>{horaFin || "-"}</Text>
                </View>
              </View>
              <View style={styles.column}>
                <Text style={styles.columnLabel}>Tiempo Total</Text>
                <View style={styles.inputBox}>
                  <Text>{tiempoTotal || "-"}</Text>
                </View>
              </View>
              <View style={styles.column}>
                <Text style={styles.columnLabel}>Operador</Text>
                <View style={styles.inputBox}>
                  <Text>{operador || "-"}</Text>
                </View>
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.column}>
                <Text style={styles.columnLabel}>Inicio Turno</Text>
                <View style={styles.inputBox}>
                  <Text>{turnoInicio || "-"}</Text>
                </View>
              </View>
              <View style={styles.column}>
                <Text style={styles.columnLabel}>Fin Turno</Text>
                <View style={styles.inputBox}>
                  <Text>{turnoFin || "-"}</Text>
                </View>
              </View>
            </View>

            {/* Inspecciones */}
            <Text style={[styles.sectionHeader, { marginTop: 12 }]}>
              Inspecciones
            </Text>
            <View style={styles.tableContainer}>
              <View style={styles.tableHeader}>
                <Text style={styles.thNumber}>N°</Text>
                <Text style={styles.thTitle}>Parte Evaluada</Text>
                <Text style={styles.thCumple}>Cumple</Text>
                <Text style={styles.thObs}>Observaciones</Text>
              </View>

              {/* Filas de inspecciones con numeración continua */}
              {chunk.map((insp, idx) => {
                const globalIndex = pageIndex * rowsPerPage + idx + 1;
                return (
                  <View key={idx} style={styles.tableRow}>
                    <Text style={styles.tdNumber}>{globalIndex}</Text>
                    <Text style={styles.tdTitle}>{insp.titulo}</Text>
                    <Text style={styles.tdCumple}>
                      {insp.cumple ? "SI" : "NO"}
                    </Text>
                    <Text style={styles.tdObs}>{insp.observaciones || "-"}</Text>
                  </View>
                );
              })}

              {/* Filas vacías */}
              {Array.from({ length: rowsPerPage - chunk.length }).map((_, i) => (
                <View key={i} style={styles.tableRow}>
                  <Text style={styles.tdNumber} />
                  <Text style={styles.tdTitle} />
                  <Text style={styles.tdCumple} />
                  <Text style={styles.tdObs} />
                </View>
              ))}
            </View>

            {/* Recomendaciones sólo en última página */}
            {pageIndex === chunks.length - 1 && (
              <>
                <Text style={styles.observationsLabel}>Recomendaciones</Text>
                <View style={styles.observationsBox}>
                  <Text>{recomendaciones || ""}</Text>
                </View>
              </>
            )}
          </View>
        </Page>
      ))}
    </Document>
  );
};

export default PDFEquipo;
