const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" }));

app.post("/leer-factura", async (req, res) => {
  try {
    const { mediaType, imageData } = req.body;

    const prompt = `Sos un asistente que analiza documentos financieros de Argentina.
Analizá este documento y determiná si es una FACTURA de servicio o un COMPROBANTE DE PAGO.

Un COMPROBANTE DE PAGO tiene características como:
- Logo o nombre de Mercado Pago, banco, homebanking
- Título "Comprobante de pago" o "Recibo de pago"
- Número de operación o número de transacción
- Campo "Persona que pagó" o "Pagador"
- Confirmación de que el pago fue realizado

Una FACTURA tiene características como:
- Logo de la empresa de servicios (EDENOR, NATURGY, AYSA, etc.)
- Período de facturación
- Fecha de vencimiento para pagar
- Monto a pagar (no monto pagado)

Respondé SOLO con un objeto JSON con estas claves exactas (sin markdown, sin texto extra):
{
  "tipo": "factura" o "comprobante",
  "servicio": "nombre del servicio (ej: EDENOR, NATURGY, AYSA, INTERNET)",
  "monto": número con punto decimal sin separador de miles (ej: 99985.05),
  "fecha": "fecha de emisión o período en formato YYYY-MM-DD o null",
  "vencimiento": "fecha de vencimiento de la FACTURA en formato YYYY-MM-DD o null (para comprobantes es null)",
  "fecha_pago": "fecha en que se realizó el pago en formato YYYY-MM-DD o null (solo para comprobantes)",
  "referencia": "número de operación, transacción o factura o null",
  "pagador": "nombre de la persona que pagó o null (solo para comprobantes)"
}

IMPORTANTE: 
- Si es comprobante, fecha_pago es la fecha del pago (NO el vencimiento), y vencimiento es null
- monto debe ser número JavaScript válido, sin puntos de miles, con punto como decimal
- Para Mercado Pago: el campo "Vencimiento" que aparece es la fecha del pago, NO un vencimiento de factura`;

    const content = mediaType === "application/pdf"
      ? [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: imageData } }, { type: "text", text: prompt }]
      : [{ type: "image", source: { type: "base64", media_type: mediaType, data: imageData } }, { type: "text", text: prompt }];

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, messages: [{ role: "user", content }] })
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    const texto = data.content?.map(i => i.text || "").join("").trim();
    const parsed = JSON.parse(texto.replace(/```json|```/g, "").trim());
    res.json(parsed);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
