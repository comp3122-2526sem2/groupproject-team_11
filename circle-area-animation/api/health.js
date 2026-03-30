export default function handler(req, res) {
  const tokenConfigured = Boolean(process.env.HF_API_TOKEN && process.env.HF_API_TOKEN.trim());
  res.status(200).json({ ok: true, tokenConfigured });
}
