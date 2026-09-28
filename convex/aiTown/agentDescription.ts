import { ObjectType, v } from 'convex/values';
import { GameId, agentId, parseGameId } from './ids';
import { LifeProfile, lifeProfile } from '../life/types';

export class AgentDescription {
  agentId: GameId<'agents'>;
  identity: string;
  plan: string;
  life?: LifeProfile;

  constructor(serialized: SerializedAgentDescription) {
    const { agentId, identity, plan, life } = serialized;
    this.agentId = parseGameId('agents', agentId);
    this.identity = identity;
    this.plan = plan;
    this.life = life;
  }

  serialize(): SerializedAgentDescription {
    const { agentId, identity, plan, life } = this;
    return { agentId, identity, plan, life };
  }
}

export const serializedAgentDescription = {
  agentId,
  identity: v.string(),
  plan: v.string(),
  life: v.optional(lifeProfile),
};
export type SerializedAgentDescription = ObjectType<typeof serializedAgentDescription>;
