var searchEl = $('#search')[0],
    nav = $('nav')[0],
    fields = 'id,assigned_to,priority,summary,status,whiteboard',
    sortField = 'priority',
    currentSearch = '',
    outstandingSearch,
    savedSearches = JSON.parse(localStorage['saved-bz-searches']) || [],
    savedSearchResults = JSON.parse(localStorage['saved-bz-search-results']) || {},
    searchTimeout;

var format = (function() {
    var regex = /\{([^}]+)\}/g;
    function f(string, values) {
        return string.replace(regex, function(_, match) {
            return values[match];
        });
    }
    return f;
})();

function handleResponse(response) {
    storeSearch(currentSearch, response);
    var resp = JSON.parse(response),
        bugs = resp.bugs,
        t = $('table')[0],
        f = fields.split(','),
        s = '<thead>';
    bugs = bugs.sort(function(a,b) {
        return a[sortField] > b[sortField];
    });
    f.forEach(function (f) {
        s += '<th>'+f;
    });
    s += '</thead><tbody>'
    bugs.forEach(function (b) {
        s += '<tr>';
        f.forEach(function (f) {
            if (f == 'id') {
                s += format('<td><a href="https://bugzil.la/{0}">{0}</a>',[b[f]]);
            } else if (f == 'assigned_to') {
                s += '<td>' + [b[f].name];
            } else {
                s += '<td>'+(b[f]||'');
            }
        });
    });
    t.innerHTML = s;
    searchTimeout = setTimeout(function() {
        if (currentSearch) {
            getBugs(currentSearch);
        }
    }, 1000 * 60 * 2);
}

function progressListener() {
    if (this.readyState == 4 && this.status == 200) {
        loadingEl = $('.loading');
        if (loadingEl.length) {
            loadingEl[0].classList.remove('loading');
        }
        handleResponse(this.responseText);
    }
}

function storeSearch(query, response) {
    localStorage['last-bz-search'] = query;
    localStorage['last-bz-response'] = response;
    if (savedSearches.indexOf(query) >= 0) {
        savedSearchResults[query] = response;
        localStorage['saved-bz-search-results'] = JSON.stringify(savedSearchResults);
    }
}

function getBugs(qs) {
    clearTimeout(searchTimeout);
    currentSearch = qs;
    searchEl.value = qs;
    searchEl.classList.add('loading');
    updateTabs();
    searchEl.blur();
    if (outstandingSearch) {
        outstandingSearch.abort();
    }
    var apiURL = "https://api-dev.bugzilla.mozilla.org/latest/bug?include_fields={0}&quicksearch={1}";
    var client = new XMLHttpRequest();
    client.onreadystatechange = progressListener;
    client.open("GET", format(apiURL, [fields, qs]));
    client.setRequestHeader('Accept',       'application/json');
    client.setRequestHeader('Content-Type', 'application/json');
    outstandingSearch = client;
    client.send();
}

function updateTabs() {
    var tabs = $('nav a');
    for (var i=0; i<savedSearches.length; i++) {
        tabs[i].classList.remove('active');
        if (currentSearch == savedSearches[i]) {
            tabs[i].classList.add('active');
            continue;
        }
    }
}

function showTab(e) {
    if (!e) return;
    var query = e.innerHTML;
    getBugs(query);
    if (query in savedSearchResults) {
        handleResponse(savedSearchResults[query]);
    }
}

searchEl.addEventListener('keypress', function(e) {
    e.stopPropagation();
    if (e.keyCode == 13) {
        getBugs(searchEl.value);
    }
    if (e.keyCode == 27) {
        e.preventDefault();
        searchEl.blur();
    }
});

$(window).on('keypress', function(e) {
    if (e.charCode == 115) { // s
        searchEl.select();
    }
    if (e.charCode == 101) { // v
        rememberSearch();
    }
    if (e.charCode == 102) { // v
        forgetSearch(currentSearch);
    }
    if (e.charCode > 48 && e.charCode < 58) { // num keys
        var n = e.charCode - 49,
                t = $('nav a')[n];
        showTab(t)
    }
    if (e.charCode == 104) { // h
        $('legend')[0].classList.toggle("show");
        e.preventDefault();
    }
});
nav.addEventListener('click', function(e) {
    e.preventDefault();
    var tgt = e.target;
    if (tgt.tagName == 'A') {
        showTab(tgt);
    }
});

function rememberSearch() {
    var qs = localStorage['last-bz-search'];
    for (var i=0; i<savedSearches.length; i++) {
        if (qs == savedSearches[i]) return;
    }
    savedSearches.push(qs);
    savedSearchResults[qs] = localStorage['last-bz-response'];
    localStorage['saved-bz-searches'] = JSON.stringify(savedSearches);
    nav.innerHTML += format('<a href="#">{0}</a>', [qs]);
    updateTabs();
}
function forgetSearch(query) {
    for (var i=0; i<savedSearches.length; i++) {
        if (query == savedSearches[i]) {
            savedSearches.splice(i,1);
            localStorage['saved-bz-searches'] = JSON.stringify(savedSearches);
            nav.removeChild(nav.childNodes[i+1]);
            break;
        };
    }
    updateTabs();
}

currentSearch = localStorage['last-bz-search'];
if (window.location.search) {
    currentSearch = decodeURI(window.location.search.substr(1));
}
if (savedSearches) {
    for (var i=0; i<savedSearches.length; i++) {
        nav.innerHTML += format('<a href="#">{0}</a>', [savedSearches[i]]);
    }
}
if (currentSearch) {
    getBugs(currentSearch);
    handleResponse(localStorage['last-bz-response']);
}
