let slides = [];
let currentSlideIndex = 0;
let currentLessonTitle = "";

function toggleMenu() {
  document.getElementById("menu-overlay").classList.toggle("hidden");
}
function goToMenu() {
  document.getElementById("lesson-container").innerHTML = "";
  document.getElementById("lesson-title").innerText = "Select a lesson";
  document.getElementById("progress-text").innerText = "";
  document.getElementById("progress-bar").style.width = "0";
  toggleMenu();
}
function loadLesson(path) {
  fetch(path).then(r=>r.text()).then(md=>{
    currentLessonTitle = path.split('/').pop().replace('.md','');
    document.getElementById("lesson-title").innerText = currentLessonTitle;
    slides = md.split(/---page---/);
    currentSlideIndex = 0;
    renderSlide();
    toggleMenu();
  });
}
function renderSlide() {
  let md = slides[currentSlideIndex].trim();
  let html = "";

  // handle directives
  if(md.match(/^\{trace:(.+)\}$/m)) {
    let letter = md.match(/^\{trace:(.+)\}$/m)[1].trim();
    html += `<h2>Trace the letter ${letter}</h2>`;
    html += `<canvas id="traceCanvas" width="300" height="300"></canvas>`;
    html += `<button onclick="checkTrace('${letter}')">Check My Trace</button>`;
    setTimeout(()=>initTrace(letter),100);
  }
  else if(md.match(/^\{pdf:(.+)\}$/m)) {
    let file = md.match(/^\{pdf:(.+)\}$/m)[1].trim();
    html += `<iframe src="assets/pdf/${file}" width="100%" height="600"></iframe>`;
  }
  else if(md.match(/^\{game:(.+)\}$/m)) {
    let params = md.match(/^\{game:(.+)\}$/m)[1].trim();
    let url = params.split(',')[0].replace('url=','');
    let fallback = params.includes('fallback=') ? params.split('fallback=')[1] : "";
    html += `<iframe src="${url}" width="100%" height="600" style="border:none;" allowfullscreen></iframe>`;
    if(fallback) html += `<p>If the game does not load, <a href="assets/games/${fallback}">try local version</a>.</p>`;
  }
  else {
    html = marked.parse(md);
  }

  // if last slide, append finish screen
  if(currentSlideIndex === slides.length-1) {
    html += `<div class="finish-screen"><h2>🎉 Great job! You completed ${currentLessonTitle}</h2>
    <button onclick="goToMenu()">Back to Menu</button>
    <button onclick="restartLesson()">Restart Lesson</button></div>`;
  }

  document.getElementById("lesson-container").innerHTML = html;
  updateProgress();
}
function updateProgress() {
  document.getElementById("progress-text").innerText = `Slide ${currentSlideIndex+1} of ${slides.length}`;
  let percent = ((currentSlideIndex+1)/slides.length)*100;
  document.getElementById("progress-bar").style.width = percent + "%";
}
function prevSlide() {
  if(currentSlideIndex>0){ currentSlideIndex--; renderSlide(); }
}
function nextSlide() {
  if(currentSlideIndex<slides.length-1){ currentSlideIndex++; renderSlide(); }
}
function restartLesson() {
  currentSlideIndex = 0;
  renderSlide();
}

// tracing logic
function initTrace(letter) {
  const canvas = document.getElementById("traceCanvas");
  const ctx = canvas.getContext("2d");
  ctx.font = "200px Arial";
  ctx.fillStyle = "lightgrey";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(letter, canvas.width/2, canvas.height/2);
  ctx.strokeStyle = "black";
  ctx.lineWidth = 5;
  let drawing=false;
  canvas.addEventListener("pointerdown", e=>{drawing=true; ctx.moveTo(e.offsetX,e.offsetY);});
  canvas.addEventListener("pointermove", e=>{if(drawing){ctx.lineTo(e.offsetX,e.offsetY); ctx.stroke();}});
  canvas.addEventListener("pointerup", ()=>drawing=false);
}
function checkTrace(letter) {
  alert("Great try tracing " + letter + "! (Scoring logic can be refined)");
}

// keyboard nav
document.addEventListener("keydown", e=>{
  if(e.key==="ArrowRight") nextSlide();
  if(e.key==="ArrowLeft") prevSlide();
});
