import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createChannelTools } from "../../src/channels/tool-defs.js";
import { eventBus } from "../../src/events/index.js";
import type { ChannelMessageEvent } from "../../src/events/index.js";

describe("createChannelTools", () => {
  it("returns array with emit_to_channel tool", () => {
    const tools = createChannelTools();
    assert.equal(tools.length, 1);
    assert.equal(tools[0].name, "emit_to_channel");
  });

  it("tool has correct description and parameters", () => {
    const [tool] = createChannelTools();
    assert.ok(tool.description.includes("SSE channel"));
    // Validate parameters accept channel + content
    const parsed = tool.parameters.parse({
      channel: "test-channel",
      content: "hello",
    });
    assert.equal(parsed.channel, "test-channel");
    assert.equal(parsed.content, "hello");
  });

  describe("execute", () => {
    const originalAgentId = process.env.AGENT_ID;

    afterEach(() => {
      if (originalAgentId !== undefined) {
        process.env.AGENT_ID = originalAgentId;
      } else {
        delete process.env.AGENT_ID;
      }
    });

    it("returns { status: 'delivered', channel } on success", async () => {
      process.env.AGENT_ID = "test.agent";
      const [tool] = createChannelTools();
      const result = await tool.execute({
        channel: "test-channel",
        content: "hello world",
      });
      assert.deepEqual(result, {
        status: "delivered",
        channel: "test-channel",
      });
    });

    it("delivers to eventBus with correct args when AGENT_ID is set", async () => {
      process.env.AGENT_ID = "cia.expectativas";
      const [tool] = createChannelTools();

      let received: ChannelMessageEvent | null = null;
      const listener = (evt: ChannelMessageEvent) => {
        received = evt;
      };
      eventBus.on("channel:message", listener);

      try {
        await tool.execute({
          channel: "cia-app.fichas",
          content: '{"type":"alert"}',
        });

        assert.ok(received, "eventBus should have received a channel:message");
        assert.equal(received!.channelId, "cia-app.fichas");
        assert.equal(received!.agentId, "cia.expectativas");
        assert.equal(received!.content, '{"type":"alert"}');
        assert.equal(received!.role, "assistant");
      } finally {
        eventBus.off("channel:message", listener);
      }
    });

    it("falls back to 'system.main' when AGENT_ID is absent", async () => {
      delete process.env.AGENT_ID;
      const [tool] = createChannelTools();

      let received: ChannelMessageEvent | null = null;
      const listener = (evt: ChannelMessageEvent) => {
        received = evt;
      };
      eventBus.on("channel:message", listener);

      try {
        await tool.execute({
          channel: "test-channel",
          content: "fallback test",
        });

        assert.ok(received);
        assert.equal(received!.agentId, "system.main");
      } finally {
        eventBus.off("channel:message", listener);
      }
    });
  });
});
