const { createReadStream } = require('fs');
const MldBackendReader = require('./MldBackendReader.js');
const { Quadstore } = require('quadstore');
const MemDown = require('memdown');
const { join } = require('path');
const { ContextParser } = require('jsonld-context-parser');
const { newEngine } = require('quadstore-comunica');
const { mark, stop, getEntries: timings } = require('marky');

const domain = 'punding-encrinal.m-ld.org';
const domainContext = {
  '@base': `http://${domain}/`,
  '@vocab': `http://${domain}/`,
  qs: 'http://qs.m-ld.org/',
  jrql: 'http://json-rql.org/',
  mld: 'http://m-ld.org/',
  xs: 'http://www.w3.org/2001/XMLSchema#',
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
};
const queries = require(`./queries/${domain}.json`);

(async function () {
  const context = await new ContextParser().parse(domainContext);
  const backend = new MemDown;
  const dataFilePath = join(__dirname, 'data', `${domain}.mld`);
  await MldBackendReader.readInto(backend, createReadStream(dataFilePath));
  const qs = new Quadstore({
    backend,
    comunica: newEngine(),
    indexes: [
      ['graph', 'subject', 'predicate', 'object'],
      ['graph', 'object', 'subject', 'predicate'],
      ['graph', 'predicate', 'object', 'subject']
    ],
    prefixes: {
      compactIri: iri => context.compactIri(iri),
      expandTerm: term => context.expandTerm(term)
    }
  });
  await qs.open();
  for (let [name, query] of Object.entries(queries)) {
    query = query.join('');
    mark(name);
    const { items, type } = await qs.sparql(query);
    stop(name);
    console.log(`${name}\n${query}\nReturned ${items.length} ${type}\n`);
  }
  timings().forEach(t => console.log(`${t.name}: ${t.duration.toFixed(0)}ms`));
})();