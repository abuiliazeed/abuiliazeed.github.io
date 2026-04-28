// GitHub API — fetch public repos
const USERNAME = 'abuiliazeed';
const GRID = document.getElementById('projectsGrid');
const SCROLL_INDICATOR = document.getElementById('scrollIndicator');

// Language to CSS class mapping
const langClass = {
  JavaScript: 'lang-js',
  TypeScript: 'lang-ts',
  Python: 'lang-python',
  HTML: 'lang-html',
  CSS: 'lang-css',
  Ruby: 'lang-ruby',
  Go: 'lang-go',
  Rust: 'lang-rust',
  Java: 'lang-java',
  PHP: 'lang-php',
  Swift: 'lang-swift',
  Kotlin: 'lang-kotlin',
  Dart: 'lang-dart',
  Shell: 'lang-shell',
  'Vue': 'lang-vue',
};

function createCard(repo) {
  const a = document.createElement('a');
  a.className = 'project-card';
  a.href = repo.html_url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';

  const lc = langClass[repo.language] || 'lang-default';

  a.innerHTML = `
    <div class="project-name">${escapeHtml(repo.name)}</div>
    <div class="project-desc">${escapeHtml(repo.description || 'No description.')}</div>
    <div class="project-meta">
      ${repo.language ? `<span class="lang-dot ${lc}"></span><span class="lang-name">${escapeHtml(repo.language)}</span>` : ''}
      ${repo.stargazers_count > 0 ? `
        <span class="project-stars">
          <svg width="12" height="12" viewBox="0 0 16 16"><path d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z"/></svg>
          ${repo.stargazers_count}
        </span>` : ''}
    </div>
  `;

  return a;
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function observeCards() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => {
          entry.target.classList.add('visible');
        }, i * 80);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.project-card').forEach(card => {
    observer.observe(card);
  });
}

async function loadRepos() {
  try {
    const res = await fetch(`https://api.github.com/users/${USERNAME}/repos?type=public&sort=updated&per_page=30`);
    if (!res.ok) throw new Error('Failed to fetch');
    const repos = await res.json();

    // Filter out the portfolio repo itself and forks
    const filtered = repos.filter(r => !r.fork && r.name !== `${USERNAME}.github.io`);
    GRID.innerHTML = '';

    if (filtered.length === 0) {
      GRID.innerHTML = '<div class="loading">No public projects yet.</div>';
      return;
    }

    filtered.forEach(repo => {
      GRID.appendChild(createCard(repo));
    });

    observeCards();
  } catch (e) {
    GRID.innerHTML = '<div class="error">Couldn\'t load projects. Please try again later.</div>';
  }
}

// Navbar scroll effect
const NAVBAR = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  NAVBAR.classList.toggle('scrolled', window.scrollY > 80);
});

// Scroll indicator
SCROLL_INDICATOR.addEventListener('click', () => {
  document.getElementById('projects').scrollIntoView({ behavior: 'smooth' });
});

// Init
loadRepos();
