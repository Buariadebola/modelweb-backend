const normalizeUsername = (value) => {
  if (value === undefined || value === null) {
    return '';
  }

  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9._-]/g, '');
};

const makeSlug = (value) => {
  const raw = String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return raw || 'model';
};

const buildUniqueSlug = async (Model, value, currentModelId = null) => {
  const base = makeSlug(value || 'model');
  let candidate = base;
  let counter = 1;

  while (true) {
    const existingModel = await Model.findOne({
      slug: candidate,
      ...(currentModelId ? { _id: { $ne: currentModelId } } : {}),
    });

    if (!existingModel) {
      return candidate;
    }

    candidate = `${base}-${counter}`;
    counter += 1;
  }
};

module.exports = {
  normalizeUsername,
  makeSlug,
  buildUniqueSlug,
};
