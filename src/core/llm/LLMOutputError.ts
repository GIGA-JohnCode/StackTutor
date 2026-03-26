// Domain-level LLM output error used when model responses fail schema/shape requirements.
export class LLMOutputError extends Error {
  readonly code: "MALFORMED_OUTPUT";

  constructor(message: string) {
    super(message);
    this.name = "LLMOutputError";
    this.code = "MALFORMED_OUTPUT";
  }
}
