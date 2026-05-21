export function el(tagName, options = {}, children = []) {
  const node = document.createElement(tagName);
  Object.entries(options).forEach(([key, value]) => {
    if (key === 'className') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value !== undefined && value !== null) node.setAttribute(key, value);
  });
  children.forEach((child) => node.append(child));
  return node;
}

export function clear(node) {
  while (node.firstChild) node.firstChild.remove();
}

export function field(labelText, input) {
  return el('label', { className: 'field' }, [el('span', { text: labelText }), input]);
}

export function textInput(value, onChange, placeholder = '') {
  const input = el('input', { type: 'text', placeholder });
  input.value = value || '';
  input.addEventListener('change', () => onChange(input.value));
  return input;
}

export function textArea(value, onChange, placeholder = '') {
  const input = el('textarea', { placeholder });
  input.value = value || '';
  input.addEventListener('change', () => onChange(input.value));
  return input;
}

export function selectInput(value, options, onChange) {
  const select = el('select');
  options.forEach((optionValue) => {
    const option = el('option', { value: optionValue, text: optionValue });
    if (optionValue === value) option.selected = true;
    select.append(option);
  });
  select.addEventListener('change', () => onChange(select.value));
  return select;
}
