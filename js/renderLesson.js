function parseFrontmatter(mdText) {
  const fmMatch = /^---\n([\s\S]*?)\n---/.exec(mdText);
  let metadata = {};
  let content = mdText;
  if (fmMatch) {
    const fmText = fmMatch[1];
    fmText.split("\n").forEach(line => {
      const [key, ...rest] = line.split(":");
      if (key && rest) metadata[key.trim()] = rest.join(":").trim();
    });
    content = mdText.slice(fmMatch[0].length).trim();
  }
  return { metadata, content };
}

function renderLesson(mdText) {
  const { metadata, content } = parseFrontmatter(mdText);
  let html = "";

  if (metadata.type === "abcs") {
    const letters = metadata.letters ? metadata.letters.split("") : [];
    html += `<h2>Trace the Letters</h2>`;
    letters.forEach(L => {
      html += `<div><h3>${L}</h3>
        <button onclick="new Audio('assets/audio/${L}.mp3').play()">Play Sound</button><br>
        <canvas id="c${L}" width="200" height="200"></canvas></div>`;
    });
    html += `<script>
      document.querySelectorAll("canvas").forEach(c => {
        const ctx = c.getContext("2d");
        let drawing = false;
        c.addEventListener("pointerdown", e => { drawing = true; ctx.moveTo(e.offsetX, e.offsetY); });
        c.addEventListener("pointermove", e => { if (drawing) { ctx.lineTo(e.offsetX, e.offsetY); ctx.stroke(); } });
        c.addEventListener("pointerup", () => drawing = false);
      });
    </script>`;
  }
  else if (metadata.type === "conversation") {
    html += `<iframe src="assets/pdf/${metadata.pdf}" width="100%" height="600"></iframe>`;
  }
  else if (metadata.type === "game") {
    html += `<iframe src="${metadata.url}" width="100%" height="600" style="border:none;" allowfullscreen></iframe>`;
    if (metadata.fallback) {
      html += `<p>If the game does not load, <a href="assets/games/${metadata.fallback}">try local version</a>.</p>`;
    }
  }

  html += marked.parse(content);
  document.getElementById("lesson-container").innerHTML = html;
}

// Auto-load .md if opened directly
if (location.pathname.endsWith(".md")) {
  fetch(location.pathname)
    .then(r => r.text())
    .then(md => renderLesson(md));
}
