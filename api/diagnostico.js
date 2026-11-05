// api/diagnostico.js — Vercel Serverless Function
// Recibe datos del formulario, llama a Groq, envía lead a La Central.
// GROQ_API_KEY, CENTRAL_URL y LEADS_API_TOKEN vienen de Vercel env vars.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { rubro, consultas, problema, nombre, email, tel } = req.body || {};

  if (!rubro || !problema || !nombre || !email) {
    return res.status(400).json({ ok: false, error: 'Faltan campos requeridos' });
  }

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  const systemPrompt = `Sos el asesor estratégico de Zynnos Labs, una agencia argentina de automatización con IA.
Catálogo de soluciones Zynnos (seleccioná UNA sola que mejor aplique):
1. Chatbot WhatsApp IA — responde consultas automáticamente las 24hs
2. Agente de ventas IA — califica leads y hace seguimiento automático
3. Automatización de seguimiento — recordatorios, cobros, re-engagement
4. Integración de sistemas — conecta WhatsApp + CRM + planillas + otros
5. Gestión de agenda IA — turnos, reservas y cancelaciones automáticas
6. Reportes automáticos — dashboards y métricas sin trabajo manual

Proyectos de referencia: Polo Antiguo (chatbot WhatsApp para restaurante), 
PalermitanHost (gestión de Airbnb con IA), Orvion Finanzas (dashboard automático).

Generá un diagnóstico en dos partes:
PARTE 1 (técnica, 2 oraciones): qué problema tiene y por qué la solución X resuelve ese problema.
PARTE 2 (analogía simple, 1 oración): explicalo como si se lo contaras a alguien sin conocimientos técnicos.

Respondé SOLO en JSON con este formato exacto:
{"solucion":"nombre de la solución elegida","diagnostico":"PARTE 1\\n\\nPARTE 2"}`;

  let groqResult = { solucion: 'Chatbot WhatsApp IA', diagnostico: '' };

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Rubro: ${rubro}\nConsultas por día: ${consultas}\nProblema principal: ${problema}` }
        ],
        temperature: 0.5,
        max_tokens: 400,
        response_format: { type: 'json_object' },
      }),
    });

    if (groqRes.ok) {
      const groqData = await groqRes.json();
      const content = groqData.choices?.[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);
      groqResult.solucion = parsed.solucion || groqResult.solucion;
      groqResult.diagnostico = parsed.diagnostico || '';
    }
  } catch (err) {
    console.error('Groq error:', err.message);
    groqResult.diagnostico = `Tu negocio en ${rubro} puede beneficiarse enormemente de la automatización. Con ${consultas} consultas diarias y el problema de "${problema}", la solución ideal es implementar un sistema que trabaje solo.\n\nEs como contratar un empleado que nunca duerme, nunca se olvida de responder y trabaja los 7 días de la semana.`;
  }

  const CENTRAL_URL = process.env.CENTRAL_URL;
  const LEADS_API_TOKEN = process.env.LEADS_API_TOKEN;

  if (CENTRAL_URL && LEADS_API_TOKEN) {
    try {
      await fetch(`${CENTRAL_URL}/api/leads/nuevo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Zynnos-Token': LEADS_API_TOKEN,
        },
        body: JSON.stringify({
          nombre, email, telefono: tel || null,
          rubro, problema,
          solucion: groqResult.solucion,
          diagnostico: groqResult.diagnostico,
        }),
      });
    } catch (err) {
      console.error('Central error:', err.message);
    }
  }

  return res.status(200).json({
    ok: true,
    solucion: groqResult.solucion,
    diagnostico: groqResult.diagnostico,
  });
}
