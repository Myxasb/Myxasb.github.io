const resultsDiv = document.getElementById('searchResults');
let isResultsHidden = false;
var data = { tractates: {} };
let currentTractateId = null;

function getMaterials(t) {
  if (!t) return [];
  if (t.craft) return t.craft.map(id => ({ item_id: id, value: 1 }));
  if (t._recipes && t._recipes[0] && t._recipes[0].materials) {

    return t._recipes[0].materials;
  }
  return [];
}

async function loadData() {
  try {
    const response = await fetch('data.json');
    if (!response.ok) throw new Error('Network response was not ok');
    data = await response.json();
  } catch (e) {
    console.warn("Failed to load data.json, using fallback empty state:", e);
    data = { tractates: {} };;
  }

  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  if (id && data.tractates[id]) {
    showPyramid(id);
  }
}

function countAll(id) {
  const t = data.tractates[id];
  if (!t) return { fragments: 0, pages: 0 };
  const materials = getMaterials(t);
  if (materials.length === 0) {
    return { fragments: 0, pages: 0 };
  }

  const result = { fragments: 0, pages: 0 };

  materials.forEach(mat => {
    const childId = mat.item_id;
    const count = mat.value || 1;
    if (childId === '17810') {
      result.fragments += count;
    } else if (childId === '18185') {
      result.pages += count;
    } else if (data.tractates[childId]) {
      const childRes = countAll(childId);
      result.fragments += childRes.fragments * count;
      result.pages += childRes.pages * count;
    }
  });

  return result;
}

function collectCounts(id, counts = {}, multiplier = 1) {
  const t = data.tractates[id];
  if (!t) return counts;
  const materials = getMaterials(t);
  if (materials.length === 0) return counts;

  materials.forEach(mat => {
    const childId = mat.item_id;
    const count = (mat.value || 1) * multiplier;
    if (childId === '17810' || childId === '18185') return;
    counts[childId] = (counts[childId] || 0) + count;
    collectCounts(childId, counts, count);
  });

  return counts;
}

function showPyramid(id, skipPush = false) {
  if (!skipPush) {
    history.pushState({ id }, "", "?id=" + id);
  }

  const tractate = data.tractates[id];
  if (!tractate) return;

  const counts = collectCounts(id);
  const total = countAll(id);
  currentTractateId = id;

  const description = tractate._description?.plain_text || "";

  const icon = tractate._icons?.[0] || `images/${id}.png`;
  document.getElementById('summary').innerHTML = `
      <div class="summary-card">
        <p data-tooltip="${tractate.name}\n ${description}">
          <img class="tooltip-img" src="${icon}" alt="${tractate.name}"
               style="width:48px;height:48px;display:block;">
        </p>
        <h3 style="color:var(--accent-color, purple);margin:0;">${tractate.name}</h3>
      </div>`;

  const pyramid = document.getElementById('pyramid');
  pyramid.innerHTML = '';

  const levels = {};
  Object.entries(counts).forEach(([tractateId, count]) => {
    const t = data.tractates[tractateId];
    if (!t) return;
    const lvl = t.level || 0;
    if (!levels[lvl]) levels[lvl] = [];
    levels[lvl].push({ id: tractateId, name: t.name, count, description: t._description?.plain_text || "" });
  });

  Object.keys(levels).sort((a, b) => b - a).forEach(lvl => {
    const row = document.createElement('div');
    row.className = 'level';

    levels[lvl].forEach(t => {
      const tIcon = data.tractates[t.id]?._icons?.[0] || `images/${t.id}.png`;
      const block = document.createElement('div');
      block.className = 'tractate-item';
      block.innerHTML = `
          <p data-tooltip="${t.name} x ${t.count}\n ${t.description}">
            <img class="tooltip-img" src="${tIcon}"
                 alt="${t.name} x ${t.count}" style="width:38px;height:38px;">
          </p>
		  <span class="count-badge">${t.count}</span>`;
      block.onclick = () => showPyramid(t.id, false);
      row.appendChild(block);
    });

    pyramid.appendChild(row);
  });

  if (total && (total.fragments > 0 || total.pages > 0)) {
    const totalRow = document.createElement('div');
    totalRow.className = 'level total-row';

    if (total.fragments > 0) {
      const fragment = document.createElement('div');
      fragment.className = 'tractate-item';
      fragment.innerHTML = `
        <p data-tooltip="Уривок небесної сторінки x ${total.fragments}">
          <img src="iconset/m/灵魂图腾.webp" style="width:38px;height:38px;"><br>
          <span class="count-badge">${total.fragments}</span>
        </p>`;
      totalRow.appendChild(fragment);
    }
    if (total.pages > 0) {
      const page = document.createElement('div');
      page.className = 'tractate-item';
      page.innerHTML = `
        <p data-tooltip="Небесна сторінка x ${total.pages}">
          <img src="iconset/m/天书_无字天书.webp" style="width:38px;height:38px;"><br>
          <span class="count-badge">${total.pages}</span>
        </p>`;
      totalRow.appendChild(page);
    }
    pyramid.appendChild(totalRow);
  }
}

function searchTractates(query) {
  query = query.toLowerCase();
  return Object.entries(data.tractates)
    .filter(([id, tractate]) => {
      const nameMatch = tractate.name.toLowerCase().includes(query);
      const description = tractate._description?.plain_text || "";
      const descMatch = description.toLowerCase().includes(query);
      const levelMatch = String(tractate.level) === query;
      return nameMatch || descMatch || levelMatch;
    })
    .map(([id, tractate]) => ({
      id,
      name: tractate.name,
      level: tractate.level,
      description: tractate._description?.plain_text || ""
    }));
}

const searchBox = document.getElementById('searchBox');
searchBox.addEventListener('click', () => {
  if (isResultsHidden && searchBox.value.trim() !== '') {
    resultsDiv.style.display = 'block';
    isResultsHidden = false;
  }
});

searchBox.addEventListener('input', e => {
  const query = e.target.value.trim();
  resultsDiv.innerHTML = '';

  if (query === '') {
    resultsDiv.style.display = 'none';
    return;
  }

  const results = searchTractates(query);
  resultsDiv.style.display = 'block';
  isResultsHidden = false;

  if (results.length > 0) {
    results.forEach(r => {
      const rIcon = data.tractates[r.id]?._icons?.[0] || `images/${r.id}.png`;
      const item = document.createElement('div');
      item.className = 'search-item';
	  item.dataset.tooltip = r.description;
      item.innerHTML = `
          <img src="${rIcon}" alt="${r.name}" style="width:32px;height:32px;">
          <div class="search-item-info">
            <b>${r.name}</b>
            <span>Рівень ${r.level}</span>
		  </div>`;
      item.onclick = () => {
        showPyramid(r.id, false);
        resultsDiv.style.display = 'none';
        isResultsHidden = true;
        searchBox.value = '';
      };
      resultsDiv.appendChild(item);
    });
  } else {
    resultsDiv.innerHTML = `<div class="search-no-results">Нічого не знайдено</div>`;
  }
});

document.addEventListener('click', e => {
  if (!resultsDiv.contains(e.target) && e.target !== searchBox) {
    resultsDiv.style.display = 'none';
    isResultsHidden = true;
  }
});

loadData();

window.addEventListener('popstate', e => {
  if (e.state?.id && data?.tractates[e.state.id]) {
    showPyramid(e.state.id, true);
  }
});

window.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  if (id && data?.tractates[id]) {
    showPyramid(id, false);
  }
});