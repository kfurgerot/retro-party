import test from "node:test";
import assert from "node:assert/strict";
import {
  buildIndividualInsights,
  buildTeamInsights,
  computeRadarScores,
  computeTeamAverageRadar,
} from "./radarPartyEngine.js";
import { RADAR_QUESTIONS } from "./radarPartyQuestions.js";

function makeRadar(value) {
  return {
    collaboration: value,
    fun: value,
    learning: value,
    alignment: value,
    ownership: value,
    process: value,
    resources: value,
    roles: value,
    speed: value,
    value: value,
  };
}

test("computeRadarScores retourne 100 partout quand toutes les reponses valent 5", () => {
  const answers = Object.fromEntries(RADAR_QUESTIONS.map((question) => [String(question.id), 5]));

  const { radar, polesPercent } = computeRadarScores(answers);

  Object.values(radar).forEach((score) => assert.equal(score, 100));
  Object.values(polesPercent).forEach((score) => assert.equal(score, 100));
});

test("computeRadarScores retourne un profil neutre quand les reponses sont absentes", () => {
  const { radar, polesPercent } = computeRadarScores({});

  Object.values(radar).forEach((score) => assert.equal(score, 50));
  Object.values(polesPercent).forEach((score) => assert.equal(score, 50));
});

test("computeTeamAverageRadar retourne un radar neutre en absence de membres", () => {
  const team = computeTeamAverageRadar([]);

  Object.values(team).forEach((score) => assert.equal(score, 50));
});

test("computeTeamAverageRadar calcule la moyenne par axe", () => {
  const team = computeTeamAverageRadar([makeRadar(20), makeRadar(80)]);

  Object.values(team).forEach((score) => assert.equal(score, 50));
});

test("buildIndividualInsights renvoie une synthese dominante avec les sections attendues", () => {
  const radar = {
    collaboration: 92,
    fun: 86,
    learning: 79,
    alignment: 66,
    ownership: 60,
    process: 55,
    resources: 38,
    roles: 32,
    speed: 28,
    value: 20,
  };

  const insights = buildIndividualInsights(radar);

  assert.ok(insights.summary.includes("Profil dominant"));
  assert.equal(insights.strengths.length, 3);
  assert.equal(insights.watchouts.length, 3);
  assert.equal(insights.workshopQuestions.length, 3);
});

test("buildTeamInsights detecte les axes polarises et expose les spreads", () => {
  const teamRadar = makeRadar(50);
  const memberRadars = [makeRadar(0), makeRadar(100)];

  const insights = buildTeamInsights(teamRadar, memberRadars);

  assert.equal(insights.polarizedAxes.length, 10);
  assert.equal(insights.divergenceAxes.length, insights.polarizedAxes.length);
  assert.equal(insights.spreads.length, 10);
  assert.ok(insights.summary.includes("divergences de perception"));
  assert.ok(insights.spreads.every((spread) => spread.polarized === true));
});
