import { DATA_CONTRACT_VERSION, PRODUCT_VERSION, normalizeState } from "./data-contract.mjs";
import { getAgeInfo } from "./core.mjs";

export const BACKUP_PRODUCT = "一两步";
export const BACKUP_FORMAT = "ylbzlyw-family-backup";
export const BACKUP_VERSION = 1;

const FAMILY_KEYS = Object.freeze([
  "children", "currentChildId", "agreements", "records",
  "fruitTransactions", "wishes", "petPeaks",
]);

export class BackupValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "BackupValidationError";
    this.code = code;
  }
}

/** Create a JSON-safe envelope containing family data only. */
export function createFamilyBackup(state, { now = new Date() } = {}) {
  const normalized = normalizeState(state);
  return {
    product: BACKUP_PRODUCT,
    format: BACKUP_FORMAT,
    backupVersion: BACKUP_VERSION,
    schemaVersion: DATA_CONTRACT_VERSION,
    appVersion: PRODUCT_VERSION,
    exportedAt: validDate(now).toISOString(),
    data: familyData(normalized),
  };
}

export function stringifyFamilyBackup(state, options) {
  return JSON.stringify(createFamilyBackup(state, options), null, 2);
}

/**
 * Parse, validate and preview without mutating current state. V1 state is
 * migrated through the central data-contract boundary.
 */
export function parseFamilyBackup(input) {
  const envelope = parseJson(input);
  validateEnvelope(envelope);
  const source = record(envelope.data);
  const sourceSchema = Number(envelope.schemaVersion ?? source.schemaVersion ?? 1);
  if (!Number.isInteger(sourceSchema) || sourceSchema < 1) {
    fail("invalid-schema", "备份的数据版本无法识别。");
  }
  if (sourceSchema > DATA_CONTRACT_VERSION) {
    fail("schema-too-new", `这份备份来自更新版本（V${sourceSchema}），当前版本还不能导入。`);
  }
  const migrated = normalizeState({ ...source, schemaVersion: sourceSchema });
  validateFamilyShape(source, migrated, sourceSchema);
  const data = familyData(migrated);
  return {
    envelope,
    data,
    state: migrated,
    preview: createBackupPreview(envelope, migrated),
  };
}

export function createBackupPreview(envelope, state) {
  const normalized = normalizeState(state);
  return {
    exportedAt: validExportedAt(envelope?.exportedAt),
    childCount: normalized.children.length,
    agreementCount: normalized.agreements.length,
    memoryCount: normalized.wishes.filter((wish) => wish.status === "completed").length,
  };
}

/** Validate compatibility and return a prepared replacement; no state changes. */
export function prepareBackupImport(currentState, input, { now = new Date() } = {}) {
  const current = normalizeState(currentState);
  if (!current.entitlement || current.entitlement.status !== "active") {
    fail("entitlement-required", "请先完成权益开通，再导入家庭备份。");
  }
  const parsed = parseFamilyBackup(input);
  validateEntitlement(parsed.state, current.entitlement, now);
  return {
    preview: parsed.preview,
    importedData: parsed.data,
    sourceSchemaVersion: Number(parsed.envelope.schemaVersion ?? parsed.envelope.data?.schemaVersion ?? 1),
  };
}

/** Apply only after the UI has obtained explicit replacement confirmation. */
export function applyPreparedBackup(currentState, prepared, { confirmed = false } = {}) {
  if (!confirmed) fail("confirmation-required", "请确认“替换当前本机数据”后再导入。");
  const current = normalizeState(currentState);
  const data = record(prepared?.importedData);
  if (!Array.isArray(data.children) || !Array.isArray(data.agreements)) {
    fail("invalid-preparation", "导入预处理结果无效，请重新选择备份文件。");
  }
  const replaced = normalizeState({
    ...current,
    ...familyData(data),
    entitlement: current.entitlement,
    settings: current.settings,
    bridgeSeen: current.bridgeSeen,
    demo: current.demo,
  });
  return {
    ...replaced,
    entitlement: current.entitlement,
    settings: current.settings,
    bridgeSeen: current.bridgeSeen,
    demo: current.demo,
  };
}

/** Convenience function for non-UI callers that already have confirmation. */
export function importFamilyBackup(currentState, input, { confirmed = false, now = new Date() } = {}) {
  const prepared = prepareBackupImport(currentState, input, { now });
  return { state: applyPreparedBackup(currentState, prepared, { confirmed }), preview: prepared.preview };
}

function validateEnvelope(envelope) {
  if (!Object.keys(envelope).length) fail("invalid-json", "备份文件不是有效的 JSON 对象。");
  if (envelope.product !== BACKUP_PRODUCT) fail("wrong-product", "这不是从“一两步”导出的家庭备份。");
  // Legacy V1 exports had no format/backupVersion fields.
  if (envelope.format && envelope.format !== BACKUP_FORMAT) fail("wrong-format", "备份文件格式不匹配。");
  if (envelope.backupVersion != null) {
    const backupVersion = Number(envelope.backupVersion);
    if (!Number.isInteger(backupVersion) || backupVersion < 1) fail("invalid-backup-version", "备份文件版本无法识别。");
    if (backupVersion > BACKUP_VERSION) fail("backup-too-new", "这份备份需要更新版本的“一两步”才能导入。");
  }
  if (!record(envelope.data) || !Object.keys(record(envelope.data)).length) fail("missing-data", "备份中没有可恢复的家庭数据。");
}

function validateFamilyShape(source, normalized, sourceSchema) {
  if (!Array.isArray(source.children)) fail("invalid-children", "备份中的孩子数据结构不正确。");
  if (!Array.isArray(source.agreements)) fail("invalid-agreements", "备份中的约定数据结构不正确。");
  if (normalized.children.length !== source.children.length) fail("invalid-child-data", "备份中有无法识别的孩子档案。");
  if (normalized.agreements.length !== source.agreements.length) fail("invalid-agreement-data", "备份中有无法识别的约定记录。");
  if (sourceSchema >= 2) {
    if (!isRecord(source.records)) fail("invalid-records", "备份中的双方记录结构不正确。");
    if (!Array.isArray(source.fruitTransactions) || !Array.isArray(source.wishes)) fail("invalid-family-data", "备份中的象果或家庭心愿结构不正确。");
    if (Object.keys(normalized.records).length !== Object.keys(source.records).length) fail("invalid-record-data", "备份中有无法识别的双方记录。");
    if (normalized.fruitTransactions.length !== source.fruitTransactions.length) fail("invalid-fruit-data", "备份中有无法识别的象果流水。");
    if (normalized.wishes.length !== source.wishes.length) fail("invalid-wish-data", "备份中有无法识别的家庭心愿。");
  } else {
    if (source.checkins != null && !isRecord(source.checkins)) fail("invalid-checkins", "旧版备份中的双方记录结构不正确。");
    if (source.redemptions != null && !Array.isArray(source.redemptions)) fail("invalid-redemptions", "旧版备份中的家庭心愿结构不正确。");
  }
}

function validateEntitlement(imported, entitlement, now) {
  const limit = entitlement.scope === "all" ? 3 : 1;
  if (imported.children.length > limit) {
    fail("child-limit", `这份备份有 ${imported.children.length} 个孩子档案，当前版本最多可使用 ${limit} 个。`);
  }
  if (entitlement.scope === "all") return;
  const allowed = entitlement.stageId;
  for (const child of imported.children) {
    const agreements = imported.agreements.filter((item) => item.childId === child.id);
    const unauthorizedAgreement = agreements.find((item) => item.stageId !== allowed);
    if (unauthorizedAgreement) {
      fail("stage-not-entitled", `孩子“${child.nickname}”的备份包含 ${stageLabel(unauthorizedAgreement.stageId)} 约定，不在当前已开通阶段内。`);
    }
    if (!agreements.length) {
      const stageId = getAgeInfo(child.birthDate, now).stage?.id || "";
      if (stageId && stageId !== allowed) {
        fail("stage-not-entitled", `孩子“${child.nickname}”当前属于 ${stageLabel(stageId)}，不在已开通阶段内。`);
      }
    }
  }
}

function familyData(value) {
  const source = record(value);
  const output = {};
  for (const key of FAMILY_KEYS) output[key] = clone(source[key] ?? (key === "records" || key === "petPeaks" ? {} : key === "currentChildId" ? "" : []));
  return output;
}

function parseJson(input) {
  const candidate = record(input);
  if (Object.keys(candidate).length) return clone(candidate);
  if (typeof input !== "string") fail("invalid-json", "备份文件不是有效的 JSON。");
  try { return record(JSON.parse(input)); }
  catch { fail("invalid-json", "备份文件已损坏，无法读取 JSON。"); }
}

function validDate(value) {
  const result = value instanceof Date ? value : new Date(value);
  return Number.isNaN(result.getTime()) ? new Date() : result;
}
function validExportedAt(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "" : date.toISOString(); }
function stageLabel(id) { return ({ s1: "0—1.5岁", s2: "1.5—3岁", s3: "3—6岁", s4: "7—12岁", s5: "12—15岁", s6: "15—18岁" })[id] || id; }
function record(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function isRecord(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function fail(code, message) { throw new BackupValidationError(code, message); }
