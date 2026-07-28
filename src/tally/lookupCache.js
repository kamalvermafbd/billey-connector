const cache = new Map();

function setLookups(company, lookups) {
    cache.set(company.trim().toUpperCase(), lookups);
}

function getLookups(company) {
    return cache.get(company.trim().toUpperCase());
}

function clearLookups(company) {
    cache.delete(company.trim().toUpperCase());
}

module.exports = {
    setLookups,
    getLookups,
    clearLookups
};