export interface AuditRecordProps {
  id: string;
  entityType: string;
  entityId: string;
  who: string;
  what: string;
  why?: string;
  when: string;
  prev?: string;
  next?: string;
  metadata?: Record<string, unknown>;
}

export class AuditRecord {
  readonly id: string;

  readonly entityType: string;

  readonly entityId: string;

  readonly who: string;

  readonly what: string;

  readonly why?: string;

  readonly when: string;

  readonly prev?: string;

  readonly next?: string;

  readonly metadata: Record<string, unknown>;

  constructor(props: AuditRecordProps) {
    if (!props.id) {
      throw new Error('AuditRecord.id is required');
    }
    if (!props.entityType) {
      throw new Error('AuditRecord.entityType is required');
    }
    if (!props.entityId) {
      throw new Error('AuditRecord.entityId is required');
    }
    if (!props.who) {
      throw new Error('AuditRecord.who is required');
    }
    if (!props.what) {
      throw new Error('AuditRecord.what is required');
    }
    if (!props.when) {
      throw new Error('AuditRecord.when is required');
    }

    this.id = props.id;
    this.entityType = props.entityType;
    this.entityId = props.entityId;
    this.who = props.who;
    this.what = props.what;
    this.why = props.why;
    this.when = props.when;
    this.prev = props.prev;
    this.next = props.next;
    this.metadata = { ...(props.metadata ?? {}) };
  }

  static fromJSON(json: AuditRecordProps): AuditRecord {
    return new AuditRecord(json);
  }
}
