import { describe, expect, it } from "vitest";
import { buildIndividualRecommendations } from "./individualRecommendations";
import type { RadarAxisValues } from "./scoring";

function buildRadar(overrides: Partial<RadarAxisValues> = {}): RadarAxisValues {
  return {
    collaboration: 50,
    fun: 50,
    learning: 50,
    alignment: 50,
    ownership: 50,
    process: 50,
    resources: 50,
    roles: 50,
    speed: 50,
    value: 50,
    ...overrides,
  };
}

describe("buildIndividualRecommendations", () => {
  it("selects weakest, second weakest and strongest axes", () => {
    const radar = buildRadar({
      learning: 20,
      speed: 28,
      value: 90,
    });

    const result = buildIndividualRecommendations(radar);

    expect(result.cards).toHaveLength(3);
    expect(result.cards[0].kind).toBe("reinforce");
    expect(result.cards[0].axis).toBe("learning");
    expect(result.cards[1].kind).toBe("next-lever");
    expect(result.cards[1].axis).toBe("speed");
    expect(result.cards[2].kind).toBe("preserve");
    expect(result.cards[2].axis).toBe("value");
  });

  it("uses stable dimension ordering when scores are equal", () => {
    const radar = buildRadar();
    const result = buildIndividualRecommendations(radar);

    expect(result.cards[0].axis).toBe("collaboration");
    expect(result.cards[1].axis).toBe("fun");
    expect(result.cards[2].axis).toBe("value");
  });

  it("never duplicates the same axis in the 3 cards", () => {
    const radar = buildRadar({
      collaboration: 10,
      fun: 10,
      value: 10,
    });
    const result = buildIndividualRecommendations(radar);
    const uniqueAxes = new Set(result.cards.map((item) => item.axis));

    expect(uniqueAxes.size).toBe(result.cards.length);
  });

  it("caps output to 3 recommendations maximum", () => {
    const radar = buildRadar({
      collaboration: 5,
      fun: 15,
      learning: 95,
      value: 96,
    });
    const result = buildIndividualRecommendations(radar);

    expect(result.cards.length).toBeLessThanOrEqual(3);
  });
});

