/* Word World: the guard list. This file exists only to keep these words OUT of what is sent to the AI service, out of the
   adviser setting the tutor saves, and out of any report shown on her page. It describes nobody.
   Used by site/ai-prompt.js (WW_AI.hasDiagnosis, hasLabel, cleanNeeds, check). The Edge Function gets a byte-for-byte copy
   (deploy/functions/weekly-analysis/guard-words.js). Matching: whole words, any letter case; an entry written in capitals
   only (a short form that is also an ordinary English word, such as ADD) matches the capital form only. */
(function (g) {
  "use strict";
  const WW_GUARD = {
    diagnosis: [
      "dyslexia", "dyslexic", "ADHD", "ADD", "autism", "autistic", "ASD", "Asperger", "Aspergers", "Asperger's",
      "dyspraxia", "dyspraxic", "dysgraphia", "dyscalculia", "disorder", "disorders", "deficit", "deficits",
      "hyperactive", "hyperactivity", "impairment", "impaired", "syndrome", "neurodivergent", "neurodiverse",
      "learning disability", "learning disabilities", "learning difficulty", "learning difficulties",
      "special needs", "special educational needs", "SEN", "SEND", "SpLD", "OCD", "ODD", "APD", "on the spectrum", "diagnosed"
    ],
    labels: [
      "slow", "slower", "behind", "weak", "weaker", "weakness", "weaknesses", "struggling", "struggle", "struggles", "struggled",
      "lazy", "careless", "poor", "bad", "stupid", "dumb", "fail", "fails", "failed", "failing", "failure", "sloppy", "messy",
      "unmotivated", "inattentive", "distractible", "naughty", "lagging", "below average", "low ability", "hopeless", "wrong"
    ]
  };
  g.WW_GUARD = WW_GUARD;
  if (typeof module !== "undefined" && module && module.exports) module.exports = WW_GUARD;
})(typeof globalThis !== "undefined" ? globalThis : window);
