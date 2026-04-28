// Book data
const BOOK = {
  title: 'Harness Engineering',
  subtitle: 'The Complete Guide to Agent-First Software Development',
  chapters: [
    { part: 'Part I — Foundations', file: 'book/chapters/part-i-foundations/chapter-01.md', label: 'Ch 1: The Agent-First Revolution' },
    { file: 'book/chapters/part-i-foundations/chapter-02.md', label: 'Ch 2: What is Harness Engineering?' },
    { file: 'book/chapters/part-i-foundations/chapter-03.md', label: 'Ch 3: The Empty Repository' },
    { file: 'book/chapters/part-i-foundations/chapter-04.md', label: 'Ch 4: The New Role of the Engineer' },
    { part: 'Part II — Context Engineering', file: 'book/chapters/part-ii-context-engineering/chapter-05.md', label: 'Ch 5: Context Engineering' },
    { file: 'book/chapters/part-ii-context-engineering/chapter-06.md', label: 'Ch 6: Advanced Context Architecture' },
    { file: 'book/chapters/part-ii-context-engineering/chapter-07.md', label: 'Ch 7: The Instruction Layer' },
    { part: 'Part III — Application Legibility', file: 'book/chapters/part-iii-application-legibility/ch8-making-applications-legible.md', label: 'Ch 8: Making Applications Legible' },
    { file: 'book/chapters/part-iii-application-legibility/ch9-building-agent-friendly-infrastructure.md', label: 'Ch 9: Agent-Friendly Infrastructure' },
    { part: 'Part IV — Architecture & Enforcement', file: 'book/chapters/part-iv-architecture-enforcement/ch10-architecture-taste-mechanical-enforcement.md', label: 'Ch 10: Architecture & Taste' },
    { file: 'book/chapters/part-iv-architecture-enforcement/ch11-designing-dependency-graph.md', label: 'Ch 11: Designing the Dependency Graph' },
    { file: 'book/chapters/part-iv-architecture-enforcement/ch12-linters-rules-automated-governance.md', label: 'Ch 12: Linters & Governance' },
    { part: 'Part V — Multi-Agent Orchestration', file: 'book/chapters/part-v-multi-agent-orchestration/chapter-13.md', label: 'Ch 13: Multi-Agent Coordination' },
    { file: 'book/chapters/part-v-multi-agent-orchestration/chapter-14.md', label: 'Ch 14: Worktree Isolation' },
    { file: 'book/chapters/part-v-multi-agent-orchestration/chapter-15.md', label: 'Ch 15: Orchestrator Patterns' },
    { part: 'Part VI — Throughput & Norms', file: 'book/chapters/part-vi-throughput-norms/chapter-16.md', label: 'Ch 16: Throughput & Norms' },
    { file: 'book/chapters/part-vi-throughput-norms/chapter-17.md', label: 'Ch 17: CI/CD Pipeline' },
    { part: 'Part VII — Autonomy & Entropy', file: 'book/chapters/part-vii-autonomy-entropy/chapter-18.md', label: 'Ch 18: Autonomy Levels' },
    { file: 'book/chapters/part-vii-autonomy-entropy/chapter-19.md', label: 'Ch 19: Entropy & Codebase Health' },
    { part: 'Part VIII — Security', file: 'book/chapters/part-viii-security/chapter-20.md', label: 'Ch 20: Security in Agent-First Dev' },
    { file: 'book/chapters/part-viii-security/chapter-21.md', label: 'Ch 21: Secure Agent Systems' },
    { part: 'Part IX — Measuring & Scaling', file: 'book/chapters/part-ix-measuring-scaling/chapter-22.md', label: 'Ch 22: Measuring ROI' },
    { file: 'book/chapters/part-ix-measuring-scaling/chapter-23.md', label: 'Ch 23: Enterprise Playbook' },
    { file: 'book/chapters/part-ix-measuring-scaling/chapter-24.md', label: 'Ch 24: Scaling to Large Teams' },
    { part: 'Part X — Tools & Platforms', file: 'book/chapters/part-x-tools-platforms/chapter-25.md', label: 'Ch 25: Agent Platform Landscape' },
    { file: 'book/chapters/part-x-tools-platforms/chapter-26.md', label: 'Ch 26: Building Your Harness' },
    { part: 'Part XI — The Future', file: 'book/chapters/part-xi-future/chapter-27.md', label: 'Ch 27: The Future of Software Engineering' },
    { part: 'Appendices', file: 'book/chapters/appendices/appendix-a.md', label: 'A: OpenAI Harness Blog Post' },
    { file: 'book/chapters/appendices/appendix-b.md', label: 'B: AGENTS.md Templates' },
    { file: 'book/chapters/appendices/appendix-c.md', label: 'C: Golden Principles Library' },
    { file: 'book/chapters/appendices/appendix-d.md', label: 'D: Linter Examples' },
    { file: 'book/chapters/appendices/appendix-e.md', label: 'E: CI Pipeline Templates' },
    { file: 'book/chapters/appendices/appendix-f.md', label: 'F: Quality Scorecard' },
    { file: 'book/chapters/appendices/appendix-g.md', label: 'G: Glossary' },
    { file: 'book/chapters/appendices/appendix-h.md', label: 'H: References' },
  ]
};

// State
let currentIndex = 0;
let sidebarOpen = window.innerWidth > 900;
const content = document.getElementById('content');
const toc = document.getElementById('toc');
const sidebar = document.getElementById('sidebar');
const tocToggle = document.getElementById('tocToggle');
const sidebarClose = document.getElementById('sidebarClose');
const prevBtn = document.getElementById('prevChapter');
const nextBtn = document.getElementById('nextChapter');
const chapterNav = document.getElementById('chapterNav');

// Configure marked
marked.setOptions({
  gfm: true,
  breaks: false,
});

// Build TOC
function buildTOC() {
  toc.innerHTML = '';
  BOOK.chapters.forEach((ch, i) => {
    if (ch.part) {
      const part = document.createElement('div');
      part.className = 'toc-part';
      part.textContent = ch.part;
      toc.appendChild(part);
    }
    const a = document.createElement('a');
    a.className = 'toc-chapter' + (i === currentIndex ? ' active' : '');
    a.href = '#';
    a.textContent = ch.label;
    a.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(i);
    });
    toc.appendChild(a);
  });
}

// Load chapter
async function loadChapter(index) {
  const ch = BOOK.chapters[index];
  try {
    const res = await fetch(ch.file);
    if (!res.ok) throw new Error('Not found');
    const md = await res.text();
    content.innerHTML = marked.parse(md);
    content.scrollTop = 0;
    window.scrollTo(0, 0);
  } catch (e) {
    content.innerHTML = `
      <h1>${ch.label}</h1>
      <p style="color: var(--color-text-secondary); margin-top: 24px;">This chapter is not yet available.</p>
    `;
  }
}

// Navigate
function navigateTo(index) {
  if (index < 0 || index >= BOOK.chapters.length) return;
  currentIndex = index;
  loadChapter(index);
  updateUI();

  // Update URL hash
  history.replaceState(null, '', '#' + index);

  // Close sidebar on mobile
  if (window.innerWidth <= 900) {
    closeSidebar();
  }
}

function updateUI() {
  // TOC active state
  const items = toc.querySelectorAll('.toc-chapter');
  items.forEach((item, i) => {
    item.classList.toggle('active', i === currentIndex);
  });

  // Nav buttons
  prevBtn.disabled = currentIndex === 0;
  nextBtn.disabled = currentIndex === BOOK.chapters.length - 1;

  // Header title
  document.querySelector('.book-header-title').textContent =
    BOOK.chapters[currentIndex].label;

  // Scroll TOC to active item
  const activeItem = toc.querySelector('.toc-chapter.active');
  if (activeItem) {
    activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

// Sidebar toggle
function openSidebar() {
  sidebarOpen = true;
  sidebar.classList.remove('hidden');
  sidebar.classList.add('open');
  content.classList.remove('full-width');
  chapterNav.classList.remove('expanded');
}

function closeSidebar() {
  sidebarOpen = false;
  sidebar.classList.add('hidden');
  sidebar.classList.remove('open');
  content.classList.add('full-width');
  chapterNav.classList.add('expanded');
}

tocToggle.addEventListener('click', () => {
  if (sidebarOpen) {
    closeSidebar();
  } else {
    openSidebar();
  }
});

sidebarClose.addEventListener('click', closeSidebar);

// Navigation buttons
prevBtn.addEventListener('click', () => navigateTo(currentIndex - 1));
nextBtn.addEventListener('click', () => navigateTo(currentIndex + 1));

// Keyboard navigation
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') navigateTo(currentIndex - 1);
  if (e.key === 'ArrowRight') navigateTo(currentIndex + 1);
});

// Init
function init() {
  // Read hash
  const hash = parseInt(window.location.hash.slice(1));
  if (!isNaN(hash) && hash >= 0 && hash < BOOK.chapters.length) {
    currentIndex = hash;
  }

  buildTOC();

  // Set initial sidebar state
  if (window.innerWidth <= 900) {
    closeSidebar();
  } else {
    openSidebar();
  }

  navigateTo(currentIndex);
}

init();
