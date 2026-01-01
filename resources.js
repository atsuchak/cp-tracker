const resources = [
    { id: 1, title: "Codeforces", category: "judges", desc: "Gold standard for contests and community blogs.", link: "https://codeforces.com/", icon: "🏆" },
    { id: 2, title: "LeetCode", category: "judges", desc: "Best for technical interviews and pattern practice.", link: "https://leetcode.com/", icon: "💻" },
    { id: 3, title: "AtCoder", category: "judges", desc: "High-quality mathematical educational problems.", link: "https://atcoder.jp/", icon: "🇯🇵" },
    { id: 4, title: "CSES Problem Set", category: "judges", desc: "300 standard problems covering all core algorithms.", link: "https://cses.fi/problemset/", icon: "🎯" },
    { id: 5, title: "CP-Algorithms", category: "algorithms", desc: "Rigorous implementations of core CP algorithms.", link: "https://cp-algorithms.com/", icon: "📖" },
    { id: 6, title: "Dynamic Programming", category: "algorithms", desc: "Master states, transitions, and optimizations.", link: "https://www.geeksforgeeks.org/dynamic-programming/", icon: "🔄" },
    { id: 7, title: "Graph Theory", category: "algorithms", desc: "Traversals (BFS/DFS) and connectivity (DSU).", link: "https://visualgo.net/en/dfsbfs", icon: "🕸️" },
    { id: 8, title: "Segment Trees", category: "algorithms", desc: "Range queries and lazy propagation implementations.", link: "https://cp-algorithms.com/data_structures/segment_tree.html", icon: "🌲" },
    { id: 9, title: "Binary Search", category: "algorithms", desc: "Search on answers and monotonic functions.", link: "https://codeforces.com/edu/course/2/lesson/6", icon: "🔍" },
    { id: 10, title: "Number Theory", category: "algorithms", desc: "Sieve, GCD, Modular Inverse, and CRT.", link: "https://rextester.com/blog/202", icon: "🔢" },
    { id: 11, title: "Striver's A2Z Sheet", category: "blogs", desc: "Legendary roadmap for mastering DSA step-by-step.", link: "https://takeuforward.org/strivers-a2z-dsa-course-sheet-2-0/", icon: "📜" },
    { id: 12, title: "USACO Guide", category: "blogs", desc: "Gold-standard curriculum categorized by level.", link: "https://usaco.guide/", icon: "🐄" },
    { id: 13, title: "VisuAlgo", category: "tools", desc: "Interactive animations of data structures.", link: "https://visualgo.net/", icon: "👁️" },
    { id: 14, title: "Wolfram Alpha", category: "tools", desc: "Solve math equations and recurrences easily.", link: "https://www.wolframalpha.com/", icon: "⚙️" }
];

function renderResources(filter = 'all', searchText = '') {
    const grid = document.getElementById('resources-grid');
    grid.innerHTML = '';

    const filtered = resources.filter(res => {
        const matchesFilter = filter === 'all' || res.category === filter;
        const matchesSearch = res.title.toLowerCase().includes(searchText.toLowerCase()) || 
                              res.desc.toLowerCase().includes(searchText.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    if (filtered.length === 0 && searchText !== '') {
        grid.innerHTML = `<div class="col-span-full py-10 text-center opacity-50 italic">Not found locally. Press Enter to search Google for "${searchText}"</div>`;
    }

    filtered.forEach(res => {
        const card = document.createElement('div');
        card.className = 'glass-card p-6 resource-card flex flex-col';
        card.innerHTML = `
            <button onclick="setFeatured(${res.id})" class="pin-btn" title="Feature this topic">📌</button>
            <div class="text-3xl mb-4">${res.icon}</div>
            <h3 class="text-lg font-black mb-2 uppercase tracking-tight">${res.title}</h3>
            <p class="text-sm opacity-70 mb-6 flex-grow leading-relaxed">${res.desc}</p>
            <a href="${res.link}" target="_blank" class="text-[10px] font-black text-blue-500 uppercase flex items-center gap-2 hover:text-blue-400 transition-colors">
               Explore Link <span>→</span>
            </a>
        `;
        grid.appendChild(card);
    });
}

// Global function to update the Recommended Card
window.setFeatured = (id) => {
    const selected = resources.find(r => r.id === id);
    renderFeatured(selected);
    // Smooth scroll to top to see the change
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

function renderFeatured(item) {
    const container = document.getElementById('featured-container');
    if (!container) return;

    // Apply a quick fade-out/in effect
    container.style.opacity = '0';
    setTimeout(() => {
        container.innerHTML = `
            <div class="glass-card p-8 border-2 border-blue-500/30 bg-blue-500/5 relative overflow-hidden">
                <div class="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div class="text-center md:text-left">
                        <span class="px-3 py-1 bg-blue-600 text-white text-[10px] font-black rounded-full uppercase tracking-widest">Recommended Topic</span>
                        <h2 class="text-3xl font-black mt-4">${item.icon} ${item.title}</h2>
                        <p class="text-slate-500 dark:text-slate-400 mt-2 max-w-xl">${item.desc}</p>
                    </div>
                    <a href="${item.link}" target="_blank" class="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/20 transition-all active:scale-95 whitespace-nowrap">
                        Start Learning
                    </a>
                </div>
                <div class="absolute -right-10 -bottom-10 text-9xl opacity-5 pointer-events-none">${item.icon}</div>
            </div>
        `;
        container.style.opacity = '1';
    }, 200);
}

// Search and Filter Logic
document.getElementById('resource-search').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const query = e.target.value.trim();
        if (!query) return;
        const matches = resources.filter(res => res.title.toLowerCase().includes(query.toLowerCase()));
        if (matches.length === 0) {
            window.open(`https://www.google.com/search?q=${encodeURIComponent(query + ' competitive programming')}`, '_blank');
        }
    }
});

document.getElementById('resource-search').addEventListener('input', (e) => {
    const activeCategory = document.querySelector('.category-pill.active').dataset.category;
    renderResources(activeCategory, e.target.value);
});

document.getElementById('category-filters').addEventListener('click', (e) => {
    if (e.target.classList.contains('category-pill')) {
        document.querySelectorAll('.category-pill').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        renderResources(e.target.dataset.category, document.getElementById('resource-search').value);
    }
});

document.getElementById('resource-search-nav')?.addEventListener('input', (e) => {
    const activeCategory = document.querySelector('.category-pill.active')?.dataset.category || 'all';
    renderResources(activeCategory, e.target.value);
});

document.addEventListener('DOMContentLoaded', () => {
    // Pick random featured on load
    const randomItem = resources[Math.floor(Math.random() * resources.length)];
    renderFeatured(randomItem);
    renderResources();
});