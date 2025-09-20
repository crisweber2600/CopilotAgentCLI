export type MetricScope = 'item' | 'workflow' | 'portfolio';

export interface MetricSetProps {
  id: string;
  scope: MetricScope;
  measures: {
    leadTime?: number;
    cycleTimePerStep?: Record<string, number>;
    throughput?: number;
    wip?: number;
    reworkRate?: number;
  };
  generatedAt: string;
  metadata?: Record<string, unknown>;
}

export class MetricSet {
  readonly id: string;
  readonly scope: MetricScope;
  readonly measures: Required<MetricSetProps['measures']>;
  readonly generatedAt: string;
  readonly metadata: Record<string, unknown>;

  constructor(props: MetricSetProps) {
    if (!props.id?.trim()) {
      throw new Error('MetricSet.id is required');
    }
    if (!props.scope?.trim()) {
      throw new Error('MetricSet.scope is required');
    }
    if (!props.generatedAt?.trim()) {
      throw new Error('MetricSet.generatedAt is required');
    }

    this.id = props.id;
    this.scope = props.scope;
    this.generatedAt = props.generatedAt;
    this.measures = {
      leadTime: props.measures.leadTime ?? 0,
      cycleTimePerStep: props.measures.cycleTimePerStep ?? {},
      throughput: props.measures.throughput ?? 0,
      wip: props.measures.wip ?? 0,
      reworkRate: props.measures.reworkRate ?? 0,
    };
    this.metadata = { ...(props.metadata ?? {}) };
  }

  static fromJSON(json: MetricSetProps): MetricSet {
    return new MetricSet(json);
  }
}
