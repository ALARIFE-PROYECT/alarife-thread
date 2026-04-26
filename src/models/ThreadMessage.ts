// export type MessageKind = "event" | "rpc:request" | "rpc:response";
 
// export interface BaseMessage {
//   kind: MessageKind;
// }
 
// export interface EventMessage extends BaseMessage {
//   kind: "event";
//   event: string;
//   payload: unknown;
// }
 
// export interface RpcRequest extends BaseMessage {
//   kind: "rpc:request";
//   id: string;
//   method: string;
//   args: unknown[];
// }
 
// export interface RpcResponse extends BaseMessage {
//   kind: "rpc:response";
//   id: string;
//   result?: unknown;
//   error?: string;
// }
 
// export type ThreadMessage = EventMessage | RpcRequest | RpcResponse;