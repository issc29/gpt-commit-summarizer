import {
  MAX_OPEN_AI_QUERY_LENGTH,
  MAX_TOKENS,
  MODEL_NAME,
  openai,
  TEMPERATURE,
} from "./openAi";
import {EventSourceParserStream} from 'eventsource-parser/stream'

const poolsideKey = process.env.POOLSIDE_KEY
const OPEN_AI_PROMPT = `You are an expert programmer, and you are trying to summarize a pull request.
You went over every commit that is part of the pull request and over every file that was changed in it.
For some of these, there was an error in the commit summary, or in the files diff summary.
Please summarize the pull request. Write your response in bullet points, starting each bullet point with a \`*\`.
Write a high level description. Do not repeat the commit summaries or the file summaries.
Write the most important bullet points. The list should not be more than a few bullet points.
`;

const linkRegex = /\[.*?\]\(https:\/\/github\.com\/.*?[a-zA-Z0-f]{40}\/(.*?)\)/;

function preprocessCommitMessage(commitMessage: string): string {
  let match = commitMessage.match(linkRegex);
  while (match !== null) {
    commitMessage = commitMessage.split(match[0]).join(`[${match[1]}]`);
    match = commitMessage.match(linkRegex);
  }
  return commitMessage;
}

export async function summarizePr(
  fileSummaries: Record<string, string>,
  commitSummaries: Array<[string, string]>
): Promise<string> {
  const commitsString = Array.from(commitSummaries.entries())
    .map(
      ([idx, [, summary]]) =>
        `Commit #${idx + 1}:\n${preprocessCommitMessage(summary)}`
    )
    .join("\n");
  const filesString = Object.entries(fileSummaries)
    .map(([filename, summary]) => `File ${filename}:\n${summary}`)
    .join("\n");
  const openAIPrompt = `${OPEN_AI_PROMPT}\n\nTHE COMMIT SUMMARIES:\n\`\`\`\n${commitsString}\n\`\`\`\n\nTHE FILE SUMMARIES:\n\`\`\`\n${filesString}\n\`\`\`\n\n
  Reminder - write only the most important points. No more than a few bullet points.
  THE PULL REQUEST SUMMARY:\n`;
  console.log(`OpenAI for PR summary prompt:\n${openAIPrompt}`);

  const jsonBody = {"prompt":openAIPrompt,"context":{}}
  try {


    var completion = ""
    var lastResponse
    const url = 'https://api.poolsi.de/v0/prompt';
    const response = await fetch(url, {
        method: 'POST',
        headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${poolsideKey}`,
        },
        body: JSON.stringify(jsonBody)
    })
    
    console.log(JSON.stringify(jsonBody))
    console.log(response)

    if (response == null || response.body == null) {
      console.log(response)
      return completion = "Could not generate"
    }

    const reader = response.body.pipeThrough(new TextDecoderStream()).pipeThrough(new EventSourceParserStream()).getReader()
    
    while (true) {
        const {value, done} = await reader.read();
        console.log(value)
    if (done) break;
      lastResponse =JSON.parse(value.data) // or just `value` if you don't need to parse it as JSON.parse() does.value)
    }
    console.log(lastResponse)
    completion = lastResponse.response.content
    return completion
  } catch (error) {
    console.error(error);
    return "Error: couldn't generate summary";
  }
}
