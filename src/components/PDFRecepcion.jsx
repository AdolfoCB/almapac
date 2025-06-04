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

// Máximo de registros por página
const rowsPerPage = 16;

// Obtiene fecha y hora actual en zona America/El_Salvador
const getFechaHoraGenerada = () =>
  new Date().toLocaleString("es-SV", { timeZone: "America/El_Salvador" });

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
    margin: 10,           // igual que tu original
    backgroundColor: "#FFFFFF",
  },
  headerRow: {
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
    fontSize: 11,
    fontWeight: "bold",
    textTransform: "uppercase",
    textAlign: "center",
  },
  title2Text: {
    fontSize: 9,
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
  // Footer fijo
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
    marginVertical: 8,
  },
  row: {
    flexDirection: "row",
    marginBottom: 6,
  },
  column: {
    flex: 1,
    marginRight: 5,
  },
  columnLabel: {
    fontSize: 9,
    fontWeight: "bold",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  inputBox: {
    borderWidth: 1,
    borderColor: "#333333",
    padding: 4,
    minHeight: 14,
    justifyContent: "center",
  },
  // Tabla de bitácoras
  tableContainer: {
    borderWidth: 1,
    borderColor: "#333333",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F5F5F5",
    borderBottomWidth: 1,
    borderColor: "#333333",
  },
  tableHeaderCell: {
    fontSize: 9,
    fontWeight: "bold",
    padding: 4,
    textAlign: "center",
    borderRightWidth: 1,
    borderColor: "#333333",
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#333333",
    minHeight: 20,
  },
  tableCell: {
    fontSize: 9,
    padding: 4,
    textAlign: "center",
    borderRightWidth: 1,
    borderColor: "#333333",
  },
});

const PDFRecepcion = ({ data }) => {
  const {
    fecha,
    hora,
    producto,
    nombreBarco,
    chequero,
    turnoInicio,
    turnoFin,
    puntoCarga,
    puntoDescarga,
    bitacoras = [],
  } = data;

  const generadoEn = getFechaHoraGenerada();

  // Dividir bitácoras en páginas
  const chunks = [];
  for (let i = 0; i < bitacoras.length; i += rowsPerPage) {
    chunks.push(bitacoras.slice(i, i + rowsPerPage));
  }
  if (chunks.length === 0) chunks.push([]);

  return (
    <Document>
      {chunks.map((chunk, pageIndex) => (
        <Page key={pageIndex} size="LETTER" style={styles.page}>
          {/* Header fijo */}
          <View style={styles.headerTable} fixed>
            <View style={styles.headerRow}>
              <View style={styles.logoColumn}>
                <Image src="/logo.png" style={styles.logo} resizeMode="contain" />
              </View>
              <View style={styles.titleColumn}>
                <View style={styles.titleRow1}>
                  <Text style={styles.title1Text}>
                    MANEJO Y ALMACENAJE DE CEREALES Y HARINAS
                  </Text>
                </View>
                <View style={styles.titleRow2}>
                  <Text style={styles.title1Text}>
                    BITÁCORA DE RECEPCIÓN Y TRASLADO DE CEREALES
                  </Text>
                </View>
              </View>
              <View style={styles.infoColumn}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>CÓDIGO:</Text>
                  <Text style={styles.infoValue}>IC-11.10</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>EDICIÓN:</Text>
                  <Text style={styles.infoValue}>2</Text>
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

          {/* Contenido */}
          <View style={styles.whiteBox}>
            <Text style={styles.sectionHeader}>Información de la Recepción</Text>
            <View style={styles.row}>
              <View style={styles.column}>
                <Text style={styles.columnLabel}>Producto</Text>
                <View style={styles.inputBox}><Text>{producto || "-"}</Text></View>
              </View>
              <View style={styles.column}>
                <Text style={styles.columnLabel}>Barco</Text>
                <View style={styles.inputBox}><Text>{nombreBarco || "-"}</Text></View>
              </View>
              <View style={styles.column}>
                <Text style={styles.columnLabel}>Chequero</Text>
                <View style={styles.inputBox}><Text>{chequero || "-"}</Text></View>
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.column}>
                <Text style={styles.columnLabel}>Inicio Turno</Text>
                <View style={styles.inputBox}><Text>{turnoInicio || "-"}</Text></View>
              </View>
              <View style={styles.column}>
                <Text style={styles.columnLabel}>Fin Turno</Text>
                <View style={styles.inputBox}><Text>{turnoFin || "-"}</Text></View>
              </View>
              <View style={styles.column}>
                <Text style={styles.columnLabel}>Punto de Carga</Text>
                <View style={styles.inputBox}><Text>{puntoCarga || "-"}</Text></View>
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.column}>
                <Text style={styles.columnLabel}>Punto de Descarga</Text>
                <View style={styles.inputBox}><Text>{puntoDescarga || "-"}</Text></View>
              </View>
            </View>

            <Text style={styles.sectionHeader}>Bitácoras</Text>
            <View style={styles.tableContainer}>
              <View style={styles.tableHeader}>
                {[
                  { label: "Placa", w: "12%" },
                  { label: "Motorista", w: "20%" },
                  { label: "Ticket", w: "12%" },
                  { label: "Inicio", w: "12%" },
                  { label: "Final", w: "12%" },
                  { label: "Total", w: "10%" },
                  { label: "Transporte", w: "20%" },
                  { label: "Observaciones", w: "12%", noBorder: true },
                ].map((col, i) => (
                  <Text
                    key={i}
                    style={[
                      styles.tableHeaderCell,
                      { width: col.w, borderRightWidth: col.noBorder ? 0 : 1 },
                    ]}
                  >
                    {col.label}
                  </Text>
                ))}
              </View>

              {/* Filas de datos */}
              {chunk.map((b, i) => (
                <View key={i} style={styles.tableRow}>
                  {[ "placa","motorista","ticket","horaInicio","horaFinal","tiempoTotal","transporte","observaciones" ].map((f, j) => (
                    <Text
                      key={j}
                      style={[
                        styles.tableCell,
                        { width:
                            j===0?"12%":
                            j===1?"20%":
                            j===2?"12%":
                            j===3?"12%":
                            j===4?"12%":
                            j===5?"10%":
                            j===6?"20%":"12%",
                          borderRightWidth: j===7?0:1,
                          textAlign: j===7?"left":"center"
                        }
                      ]}
                    >
                      {b[f] || (f==="observaciones"?"-":"")}
                    </Text>
                  ))}
                </View>
              ))}

              {/* Filas vacías */}
              {Array.from({ length: rowsPerPage - chunk.length }).map((_, i) => (
                <View key={i} style={styles.tableRow}>
                  {Array(8).fill(null).map((_, j) => (
                    <Text
                      key={j}
                      style={[
                        styles.tableCell,
                        {
                          width:
                            j===0?"12%":
                            j===1?"20%":
                            j===2?"12%":
                            j===3?"12%":
                            j===4?"12%":
                            j===5?"10%":
                            j===6?"20%":"12%",
                          borderRightWidth: j===7?0:1,
                        }
                      ]}
                    />
                  ))}
                </View>
              ))}
            </View>
          </View>
        </Page>
      ))}
    </Document>
  );
};

export default PDFRecepcion;
