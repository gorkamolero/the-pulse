/**
 * HTML Report Visualization
 *
 * Generate interactive HTML reports for session analysis
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { SessionResult } from '../session/runner';

const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test Harness Report - {{sessionId}}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
      padding: 2rem;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    .header {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      margin-bottom: 2rem;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 { font-size: 2rem; margin-bottom: 1rem; color: #1a1a1a; }
    .meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-top: 1rem; }
    .meta-item { padding: 0.5rem; background: #f8f9fa; border-radius: 4px; }
    .meta-label { font-size: 0.875rem; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
    .meta-value { font-size: 1.25rem; font-weight: 600; color: #1a1a1a; margin-top: 0.25rem; }

    .section {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      margin-bottom: 2rem;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h2 { font-size: 1.5rem; margin-bottom: 1.5rem; color: #1a1a1a; border-bottom: 2px solid #e0e0e0; padding-bottom: 0.5rem; }

    .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; }
    .metric-card {
      padding: 1.5rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .metric-card.success { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); }
    .metric-card.warning { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
    .metric-card.info { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }
    .metric-label { font-size: 0.875rem; opacity: 0.9; text-transform: uppercase; letter-spacing: 0.5px; }
    .metric-value { font-size: 2rem; font-weight: 700; margin-top: 0.5rem; }
    .metric-subtitle { font-size: 0.875rem; opacity: 0.8; margin-top: 0.5rem; }

    .progress-bar {
      width: 100%;
      height: 24px;
      background: #e0e0e0;
      border-radius: 12px;
      overflow: hidden;
      margin: 1rem 0;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 600;
      font-size: 0.875rem;
      transition: width 0.3s ease;
    }

    .timeline {
      position: relative;
      padding-left: 2rem;
      margin-top: 2rem;
    }
    .timeline::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 2px;
      background: #e0e0e0;
    }
    .timeline-item {
      position: relative;
      padding: 1rem 0;
    }
    .timeline-marker {
      position: absolute;
      left: -2.4rem;
      top: 1.2rem;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #667eea;
      border: 3px solid white;
      box-shadow: 0 0 0 2px #667eea;
    }
    .timeline-marker.pulse { background: #11998e; box-shadow: 0 0 0 2px #11998e; }
    .timeline-marker.tangent { background: #f5576c; box-shadow: 0 0 0 2px #f5576c; }
    .timeline-marker.private { background: #764ba2; box-shadow: 0 0 0 2px #764ba2; }
    .timeline-content {
      background: #f8f9fa;
      padding: 1rem;
      border-radius: 4px;
      border-left: 3px solid #667eea;
    }
    .timeline-turn { font-weight: 600; color: #667eea; margin-bottom: 0.5rem; }
    .timeline-type { display: inline-block; padding: 0.25rem 0.5rem; background: #667eea; color: white; border-radius: 4px; font-size: 0.75rem; text-transform: uppercase; margin-bottom: 0.5rem; }

    .cost-breakdown {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
      margin-top: 1.5rem;
    }
    .cost-item {
      padding: 1rem;
      background: #f8f9fa;
      border-radius: 4px;
      border-left: 3px solid #667eea;
    }
    .cost-label { font-weight: 600; margin-bottom: 0.5rem; }
    .cost-details { font-size: 0.875rem; color: #666; }

    .badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 12px;
      font-size: 0.875rem;
      font-weight: 600;
    }
    .badge.completed { background: #d4edda; color: #155724; }
    .badge.timeout { background: #fff3cd; color: #856404; }
    .badge.failed { background: #f8d7da; color: #721c24; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Test Harness Session Report</h1>
      <div class="meta">
        <div class="meta-item">
          <div class="meta-label">Session ID</div>
          <div class="meta-value">{{sessionId}}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Story</div>
          <div class="meta-value">{{storyTitle}}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Outcome</div>
          <div class="meta-value"><span class="badge {{outcome}}">{{outcome}}</span></div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Duration</div>
          <div class="meta-value">{{duration}}</div>
        </div>
      </div>
    </div>

    <div class="section">
      <h2>Key Metrics</h2>
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">Final Turn</div>
          <div class="metric-value">{{finalTurn}}</div>
          <div class="metric-subtitle">of {{maxTurns}} maximum</div>
        </div>
        <div class="metric-card success">
          <div class="metric-label">Story Pulses</div>
          <div class="metric-value">{{pulseCount}}</div>
          <div class="metric-subtitle">{{pulsePercentage}}% completion</div>
        </div>
        <div class="metric-card warning">
          <div class="metric-label">Tangents</div>
          <div class="metric-value">{{tangentCount}}</div>
          <div class="metric-subtitle">{{tangentRate}}% of turns</div>
        </div>
        <div class="metric-card info">
          <div class="metric-label">Private Moments</div>
          <div class="metric-value">{{privateMomentCount}}</div>
          <div class="metric-subtitle">{{payoffRate}}% paid off</div>
        </div>
      </div>

      <div style="margin-top: 2rem;">
        <h3 style="margin-bottom: 1rem;">Pulse Progress</h3>
        <div class="progress-bar">
          <div class="progress-fill" style="width: {{pulsePercentage}}%">
            {{pulseCount}} / 20 pulses
          </div>
        </div>
      </div>
    </div>

    {{costSection}}

    {{tangentSection}}

    <div class="section">
      <h2>Session Timeline</h2>
      <div class="timeline">
        {{timelineItems}}
      </div>
    </div>
  </div>
</body>
</html>`;

/**
 * Generate HTML report from session result
 */
export async function generateHTMLReport(result: SessionResult): Promise<string> {
  const pulseCount = result.detectedPulses.length;
  const pulsePercentage = Math.round((pulseCount / 20) * 100);
  const tangentCount = result.tangentAnalysis?.totalTangents || 0;
  const tangentRate = result.finalTurn > 0 ? ((tangentCount / result.finalTurn) * 100).toFixed(1) : '0';
  const privateMomentCount = result.privateMoments.length;
  const paidOffCount = result.privateMoments.filter((pm: any) => pm.payoffDetected).length;
  const payoffRate = privateMomentCount > 0 ? Math.round((paidOffCount / privateMomentCount) * 100) : 0;

  // Cost section
  let costSection = '';
  if (result.costBreakdown) {
    costSection = `
    <div class="section">
      <h2>Cost Breakdown</h2>
      <div class="cost-breakdown">
        <div class="cost-item">
          <div class="cost-label">Narrator: $${result.costBreakdown.narrator.cost.toFixed(4)}</div>
          <div class="cost-details">
            ${result.costBreakdown.narrator.tokens.totalTokens.toLocaleString()} tokens
          </div>
        </div>
        <div class="cost-item">
          <div class="cost-label">Players: $${result.costBreakdown.players.cost.toFixed(4)}</div>
          <div class="cost-details">
            ${result.costBreakdown.players.tokens.totalTokens.toLocaleString()} tokens
          </div>
        </div>
        <div class="cost-item">
          <div class="cost-label">Classification: $${result.costBreakdown.classification.cost.toFixed(4)}</div>
          <div class="cost-details">
            ${result.costBreakdown.classification.tokens.totalTokens.toLocaleString()} tokens
          </div>
        </div>
        <div class="cost-item" style="border-left-color: #11998e;">
          <div class="cost-label">Total: $${result.costBreakdown.total.cost.toFixed(4)}</div>
          <div class="cost-details">
            ${result.costBreakdown.total.tokens.totalTokens.toLocaleString()} total tokens
          </div>
        </div>
      </div>
    </div>`;
  }

  // Tangent section
  let tangentSection = '';
  if (result.tangentAnalysis && tangentCount > 0) {
    const dist = result.tangentAnalysis.handlingDistribution;
    tangentSection = `
    <div class="section">
      <h2>Tangent Analysis</h2>
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">Redirected</div>
          <div class="metric-value">${dist.redirected}</div>
          <div class="metric-subtitle">Successfully returned to story</div>
        </div>
        <div class="metric-card info">
          <div class="metric-label">Acknowledged</div>
          <div class="metric-value">${dist.acknowledged}</div>
          <div class="metric-subtitle">Brief acknowledgment</div>
        </div>
        <div class="metric-card warning">
          <div class="metric-label">Engaged</div>
          <div class="metric-value">${dist.engaged}</div>
          <div class="metric-subtitle">Fully engaged with tangent</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Avg Return Time</div>
          <div class="metric-value">${result.tangentAnalysis.avgTurnsToReturn.toFixed(1)}</div>
          <div class="metric-subtitle">turns until story returns</div>
        </div>
      </div>
    </div>`;
  }

  // Timeline items
  const timelineItems = result.conversationHistory
    .filter((msg: any) => msg.role === 'narrator')
    .slice(0, 30) // Limit to first 30 for performance
    .map((msg: any) => {
      const isPulse = result.detectedPulses.includes(msg.turn);
      const isTangent = msg.classification === 'tangent-response';
      const isPrivate = msg.classification === 'private-moment';

      let markerClass = '';
      let typeLabel = 'Narrative';

      if (isPulse) {
        markerClass = 'pulse';
        typeLabel = 'Pulse';
      } else if (isTangent) {
        markerClass = 'tangent';
        typeLabel = 'Tangent';
      } else if (isPrivate) {
        markerClass = 'private';
        typeLabel = 'Private Moment';
      }

      const content = msg.content.substring(0, 150) + (msg.content.length > 150 ? '...' : '');

      return `
        <div class="timeline-item">
          <div class="timeline-marker ${markerClass}"></div>
          <div class="timeline-content">
            <div class="timeline-turn">Turn ${msg.turn}</div>
            <div class="timeline-type">${typeLabel}</div>
            <div>${content}</div>
          </div>
        </div>`;
    })
    .join('');

  const html = HTML_TEMPLATE
    .replace(/{{sessionId}}/g, result.sessionId)
    .replace(/{{storyTitle}}/g, result.config.story.storyTitle)
    .replace(/{{outcome}}/g, result.outcome)
    .replace(/{{duration}}/g, `${Math.round(result.duration / 1000)}s`)
    .replace(/{{finalTurn}}/g, result.finalTurn.toString())
    .replace(/{{maxTurns}}/g, result.config.maxTurns.toString())
    .replace(/{{pulseCount}}/g, pulseCount.toString())
    .replace(/{{pulsePercentage}}/g, pulsePercentage.toString())
    .replace(/{{tangentCount}}/g, tangentCount.toString())
    .replace(/{{tangentRate}}/g, tangentRate)
    .replace(/{{privateMomentCount}}/g, privateMomentCount.toString())
    .replace(/{{payoffRate}}/g, payoffRate.toString())
    .replace(/{{costSection}}/g, costSection)
    .replace(/{{tangentSection}}/g, tangentSection)
    .replace(/{{timelineItems}}/g, timelineItems);

  return html;
}

/**
 * Save HTML report to file
 */
export async function saveHTMLReport(result: SessionResult): Promise<string> {
  const html = await generateHTMLReport(result);
  const outputDir = 'test-harness-reports';
  const filename = `${result.sessionId}.html`;
  const filepath = join(process.cwd(), outputDir, filename);

  await mkdir(join(process.cwd(), outputDir), { recursive: true });
  await writeFile(filepath, html, 'utf-8');

  return filepath;
}
