const MODELS = [
  "CohereLabs/tiny-aya-global:cohere",
  "CohereLabs/c4ai-command-r7b-12-2024:cohere",
  "CohereLabs/aya-expanse-32b:cohere"
];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const token = process.env.HF_API_TOKEN;
  if (!token || !token.trim()) {
    return res.status(500).json({ error: "Server missing HF_API_TOKEN environment variable." });
  }

  const prompt = req.body && typeof req.body.prompt === "string" ? req.body.prompt.trim() : "";
  if (!prompt) {
    return res.status(400).json({ error: "Missing prompt" });
  }

  try {
    let lastError = null;

    for (const model of MODELS) {
      const hfResp = await fetch("https://router.huggingface.co/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          stream: false
        })
      });

      const rawText = await hfResp.text();
      let data;
      try {
        data = JSON.parse(rawText);
      } catch (_parseError) {
        lastError = { model, error: "Invalid JSON from Hugging Face", detail: rawText };
        continue;
      }

      if (!hfResp.ok) {
        if (hfResp.status === 404 || hfResp.status === 410) {
          lastError = { model, status: hfResp.status, detail: data };
          continue;
        }
        return res.status(hfResp.status).json({
          error: "Hugging Face request failed",
          detail: data,
          model
        });
      }

      if (data && Array.isArray(data.choices) && data.choices.length > 0) {
        const content = data.choices[0]?.message?.content;
        if (content) {
          return res.status(200).json({ generated_text: content, model });
        }
      }

      lastError = { model, error: "Unexpected response format", detail: data };
    }

    return res.status(502).json({ error: "No available model succeeded", lastError });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Unknown server error" });
  }
}
