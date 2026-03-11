const normalizeText = (value) => String(value ?? 'unknown');

export const buildRecordFilters = ({ providerFilter, modelFilter } = {}) => ({
  providerAllow: providerFilter
    ? new Set(
        providerFilter
          .split(',')
          .map((providerName) => providerName.trim().toLowerCase())
          .filter(Boolean),
      )
    : null,
  modelNeedle: modelFilter?.trim().toLowerCase() || null,
});

export const normalizeProvider = (value) => normalizeText(value).toLowerCase();

export const normalizeModel = (value) => normalizeText(value);

export const matchesRecordFilters = (record, { providerAllow, modelNeedle }) => {
  const provider = normalizeProvider(record.provider);
  const model = normalizeModel(record.model);

  if (providerAllow && !providerAllow.has(provider)) {
    return false;
  }

  if (modelNeedle && !model.toLowerCase().includes(modelNeedle)) {
    return false;
  }

  return true;
};
