import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { startServer } from "./index.js";

test("startServer applique les migrations puis expose /health", async () => {
  const calls = [];

  const startedServer = await startServer({
    port: 0,
    initializeDatabase: async () => {
      calls.push("migrations");
    },
    logger: { log() {} },
  });

  try {
    assert.deepEqual(calls, ["migrations"]);

    const address = startedServer.address();
    assert.ok(address && typeof address === "object");
    const response = await fetch(`http://127.0.0.1:${address.port}/health`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(payload, { ok: true });
  } finally {
    await new Promise((resolve, reject) => {
      startedServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
});

test("startServer échoue sans ouvrir de port si initializeDatabase échoue", async () => {
  let listenCalled = false;
  const fakeServer = {
    listen() {
      listenCalled = true;
    },
    once() {},
    off() {},
    address() {
      return null;
    },
  };

  await assert.rejects(
    startServer({
      initializeDatabase: async () => {
        throw new Error("db init failed");
      },
      listenServer: fakeServer,
      logger: { log() {} },
    }),
    /db init failed/
  );

  assert.equal(listenCalled, false);
});

test("startServer propage une erreur listen", async () => {
  const fakeServer = new EventEmitter();
  fakeServer.listen = () => {
    fakeServer.emit("error", new Error("bind failed"));
  };
  fakeServer.address = () => null;

  await assert.rejects(
    startServer({
      initializeDatabase: async () => {},
      listenServer: fakeServer,
      logger: { log() {} },
    }),
    /bind failed/
  );
});
