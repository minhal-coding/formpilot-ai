const counters = { input: 0, change: 0, submit: 0 };
window.demoCounters = counters;
const update = () => { document.querySelector('#counters').textContent = `Input events: ${counters.input} · Change / autosave events: ${counters.change} · Submissions: ${counters.submit}`; };
const form = document.querySelector('form');
form.addEventListener('input', () => { counters.input++; update(); });
form.addEventListener('change', () => { counters.change++; update(); });
form.addEventListener('submit', event => { event.preventDefault(); counters.submit++; update(); });
form.addEventListener('reset', () => { counters.input = counters.change = counters.submit = 0; update(); });
document.querySelector('#mutate').addEventListener('click', () => { document.querySelector('label[for=email]').textContent = 'Government ID'; });
