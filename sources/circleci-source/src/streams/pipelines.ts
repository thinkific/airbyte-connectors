import {AxiosInstance} from 'axios';
import {AirbyteLogger, AirbyteStreamBase, SyncMode} from 'faros-airbyte-cdk';
import {Dictionary} from 'ts-essentials';

import {CircleCI, CircleCIConfig} from '../circleci/circleci';
import {Pipeline} from '../circleci/typings';

type StreamSlice = {
  repoName: string;
};

type PipelineState = Dictionary<{lastUpdatedAt?: string}>;

export class Pipelines extends AirbyteStreamBase {
  constructor(
    logger: AirbyteLogger,
    private readonly config: CircleCIConfig,
    private readonly axios?: AxiosInstance
  ) {
    super(logger);
  }
  getJsonSchema(): Dictionary<any, string> {
    return require('../../resources/schemas/pipelines.json');
  }

  get primaryKey(): string {
    return 'id';
  }

  get cursorField(): string {
    return 'updated_at';
  }

  async *streamSlices(): AsyncGenerator<StreamSlice> {
    for (const repoName of this.config.repo_names) {
      yield {
        repoName,
      };
    }
  }

  async *readRecords(
    syncMode: SyncMode,
    cursorField?: string[],
    streamSlice?: StreamSlice,
    streamState?: PipelineState
  ): AsyncGenerator<Pipeline, any, unknown> {
    const lastUpdatedAt =
      syncMode === SyncMode.INCREMENTAL
        ? streamState?.[streamSlice.repoName]?.lastUpdatedAt
        : undefined;
    const circleCI = CircleCI.instance(this.config, this.axios);
    yield* circleCI.fetchPipelines(streamSlice.repoName, lastUpdatedAt);
  }
  getUpdatedState(
    currentStreamState: PipelineState,
    latestRecord: Pipeline
  ): PipelineState {
    const repoName = latestRecord.project_slug;
    const repoState = currentStreamState[repoName] ?? {};

    const newRepoState = {
      lastUpdatedAt:
        new Date(latestRecord.updated_at) >
        new Date(repoState.lastUpdatedAt ?? 0)
          ? latestRecord.updated_at
          : repoState.lastUpdatedAt,
    };
    return {...currentStreamState, [repoName]: newRepoState};
  }
}
