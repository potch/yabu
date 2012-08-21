var searchForm = $('#search-form'),
    searchEl = $('#search'),
    nav = $('#tabs'),
    fields = 'id,assigned_to,priority,summary,status,whiteboard',
    sortField = 'priority',
    tabTemplate = '<li><a href="javascript:;" data-query="{0}"><button type="button" class="close">×</button>{0}</a></li>',
    titleTemplate = '({1}) {0} - yabu - yet another bugzilla ui',
    currentSearch = '',
    outstandingSearch,
    savedSearches = JSON.parse(localStorage['saved-bz-searches'] || '[]'),
    savedSearchResults = JSON.parse(localStorage['saved-bz-search-results'] || '{}'),
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

var escape_ = function(s) {
    if (s === undefined) {
        return;
    }
    return s.replace(/&/g, '&amp;').replace(/>/g, '&gt;').replace(/</g, '&lt;')
            .replace(/'/g, '&#39;').replace(/"/g, '&#34;');
};

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
                s += format('<td><a href="https://bugzilla.mozilla.org/show_bug.cgi?id={0}">{0}</a>',[b[f]]);
            } else if (f == 'assigned_to') {
                s += '<td>' + [b[f].name];
            } else {
                s += '<td>'+escape_(b[f]||'');
            }
        });
    });
    t.innerHTML = s;
    document.title = format(titleTemplate, [currentSearch, bugs.length]);
    searchTimeout = setTimeout(function() {
        if (currentSearch) {
            getBugs(currentSearch);
        }
    }, 1000 * 60 * 2);
}

function progressListener() {
    var loadingEl = $('#loading');
    if (this.readyState == 4 && this.status) {
        loadingEl[0].classList.remove('loading');
        if (this.status == 200) {
            handleResponse(this.responseText);
        }
    }
}

function storeSearch(query, response) {
    localStorage['last-bz-search'] = query;
    localStorage['last-bz-response'] = response;
    rememberSearch();
    if (savedSearches.indexOf(query) >= 0) {
        savedSearchResults[query] = response;
        localStorage['saved-bz-search-results'] = JSON.stringify(savedSearchResults);
    }
}

function getBugs(qs) {
    clearTimeout(searchTimeout);
    currentSearch = qs;
    searchEl.val(qs);
    $('#loading')[0].classList.add('loading');
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
    var tabs = $('#tabs li');
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
    var query = $(e).data('query');
    getBugs(query);
    if (query in savedSearchResults) {
        handleResponse(savedSearchResults[query]);
    }
}

searchForm.on('submit', function(e) {
    e.preventDefault();
    getBugs(searchEl.val());
});

Mousetrap.bind('s', function() {
    searchEl.select();
});

$('#legend').modal();
Mousetrap.bind('h', function() {
    $('#help').modal('toggle');
});

Mousetrap.bind(['0','1','2','3','4','5','6','7','8','9'], function(e) {
    if (e.charCode > 48 && e.charCode < 58) { // num keys
        var n = e.charCode - 49,
                t = $('#tabs li').eq(n).find('a');
        if (t.length) showTab(t);
    }
});

nav.on('click', 'a', function(e) {
    console.log(this);
    var tgt = e.target;
    showTab(this);
});
nav.on('click', '.close', function(e) {
    var tgt = $(this).parent();
    closeTab(tgt);
    e.stopPropagation();
});

function rememberSearch() {
    var qs = localStorage['last-bz-search'];
    for (var i=0; i<savedSearches.length; i++) {
        if (qs == savedSearches[i]) return;
    }
    savedSearches.push(qs);
    savedSearchResults[qs] = localStorage['last-bz-response'];
    localStorage['saved-bz-searches'] = JSON.stringify(savedSearches);
    nav.append(format(tabTemplate, [qs]));
    updateTabs();
}

function closeTab(tab) {
    forgetSearch($(tab).data('query'));
}
function forgetSearch(query) {
    if (outstandingSearch && currentSearch == query) {
        outstandingSearch.abort();
    }
    for (var i=0; i<savedSearches.length; i++) {
        if (query == savedSearches[i]) {
            savedSearches.splice(i,1);
            localStorage['saved-bz-searches'] = JSON.stringify(savedSearches);
            nav.children().eq(i).remove();
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
        nav.append(format(tabTemplate, [savedSearches[i]]));
    }
}
if (currentSearch) {
    getBugs(currentSearch);
    handleResponse(localStorage['last-bz-response']);
}
