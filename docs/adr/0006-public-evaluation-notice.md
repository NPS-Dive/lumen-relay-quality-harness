# ADR 0006: Public repository with an evaluation-only grant

- Status: accepted
- Date: 2026-10-20

## Context

The author wants hiring reviewers to read and run the work, and also wants reuse to require written consent. Those goals are not the same as an open-source license, and they are not the same as a repository nobody can see.

GitHub's Terms of Service grant other users the right to view and fork a public repository inside GitHub, and they grant GitHub a license to host and process that content to run and improve the service, including AI features. A file in the repository cannot cancel those terms. A private repository is the setting that withholds public viewing.

## Decision

The repository is public. [LICENSE](../../LICENSE) keeps all rights reserved and adds a narrow permission: view the repository, and clone and run it locally, only to evaluate the author for employment. Republication, modification, product use, and use as training data by a third party need prior written consent. The notice says it is not legal advice and not an open-source license. The copyright holder is the git identity `NPS-Dive`.

## Alternatives

- MIT. Rejected for this repository. It would allow product use and republication, which is the opposite of the consent rule the author chose.
- No license file. Rejected. Readers then guess. GitHub's own guidance is that the absence of a license is all rights reserved, and that a public repository still has the platform grants. Saying that in the file is clearer.
- A private repository shared only with named employers. This matches a strict no-viewing rule more closely. It was not chosen, because the author asked for a public evaluation copy and accepted GitHub's public terms.

## Consequences

Someone can fork the repository inside GitHub even though the notice forbids reuse outside the evaluation grant. Employers can still clone and run it. The author should treat the public copy as visible, and should not put secrets in it. There are none in this tree.
