import { createActorContext } from "@xstate/react";
import { sageMachine } from "../machine/sageMachine";

/** Single app-wide Sage actor. Components select narrow slices (no per-frame renders). */
export const SageActor = createActorContext(sageMachine);
