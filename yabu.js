var searchForm = $('#search-form'),
    searchEl = $('#search'),
    nav = $('#tabs'),
    fields = 'id,assigned_to,priority,summary,status,last_change_time,whiteboard',
    fieldsPretty = {
        'assigned_to': 'assigned to',
        'last_change_time': 'changed'
    },
    sortField = localStorage['sort-field'] || 'last_change_time',
    sortDirection = localStorage['sort-direction'] === 'true',
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
    clearTimeout(searchTimeout);
    storeSearch(currentSearch, response);
    var resp = JSON.parse(response),
        bugs = resp.bugs,
        t = $('table')[0],
        f = fields.split(','),
        s = '<thead>';
    bugs = bugs.sort(function(a,b) {
        var i = 0,
            aa = a[sortField],
            bb = b[sortField];
        if(aa > bb) {
            i = 1;
        } else if(aa < bb) {
            i = -1;
        }

        if(!sortDirection) {
            i *= -1;
        }
        return i;
    });
    f.forEach(function (f) {
        var className = '';
        if (sortField === f) {
            className = 'sorted ';
            className += sortDirection ? 'asc' : 'desc';
        }
        s += format('<th class="{2}" data-field="{0}">{1}', [f, (fieldsPretty[f] || f), className]);
    });
    s += '</thead><tbody>'
    bugs.forEach(function (b) {
        s += '<tr>';
        f.forEach(function (f) {
            if (f == 'id') {
                s += format('<td><a target="_blank" href="https://bugzilla.mozilla.org/show_bug.cgi?id={0}">{0}</a>',[b[f]]);
            } else if (f == 'assigned_to') {
                s += '<td>' + b[f].name;
            } else if (f == 'last_change_time') {
                var d = []
                s += '<td>' + timedelta(b[f]);
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

function timedelta(d1) {
    d1 = new Date(d1);
    var d2 = new Date();
    var d = ~~((d2.getTime() - d1.getTime()) / 1000);
    if (d < 60) return 'just now';
    if (d < 120) return 'a minute ago';
    if (d < 3600) return ~~(d/60) + ' minutes ago';
    d = ~~(d/3600);
    if (d < 2) return 'an hour ago';
    if (d < 24) return d + ' hours ago';
    d = ~~(d/24);
    if (d < 2) return 'a day ago';
    if (d < 365) return d + ' days ago';
    if (d < 365*2) return 'a year ago';
    return ~~(d / 365) + ' years ago';
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
    var apiURL = "https://bugzilla.mozilla.org/bzapi/latest/bug?include_fields={0}&quicksearch={1}";
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
    var n = e.charCode - 49;
    var tabs = $('#tabs li');
    var t = tabs.eq(Math.min(n,tabs.length-1)).find('a');
    if (e.charCode > 48 && e.charCode < 58) { // num keys
        if (t.length) showTab(t);
    }
});

nav.on('click', 'a', function(e) {
    var tgt = e.target;
    showTab(this);
});
nav.on('click', '.close', function(e) {
    var tgt = $(this).parent();
    closeTab(tgt);
    e.stopPropagation();
});

$('#results').on('click', 'th', function() {
    var field = $(this).data('field');
    if (!field) return;
    if (field != sortField) {
        sortField = field;
        localStorage['sort-field'] = sortField;
    } else {
        sortDirection = !sortDirection;
        localStorage['sort-direction'] = sortDirection;
    }
    refreshResults();
});

function refreshResults() {
    handleResponse(savedSearchResults[currentSearch]);
}

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
    var query = $(tab).data('query');
    forgetSearch(query);
    if (currentSearch == query)
        showTab(nav.find('a').eq(0));
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
