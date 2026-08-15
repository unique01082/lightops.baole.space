import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ToolResultStage } from './tool-result-stage';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const outputs = [
  {
    sourcePath: '/shoot/a.jpg',
    outputPath: '/output/a-resized.jpg',
    byteSize: 1024,
    width: 1200,
    height: 800,
    savingsBytes: 512,
  },
  {
    sourcePath: '/shoot/b.jpg',
    outputPath: '/output/b-resized.jpg',
    byteSize: 2048,
    width: 1200,
    height: 800,
    savingsBytes: 256,
  },
];

describe('ToolResultStage', () => {
  it('announces running progress and offers cancellation', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <ToolResultStage
        progress={{
          jobId: 'job-1',
          phase: 'processing',
          current: 0,
          total: 2,
          messageKey: 'jobs.processing',
        }}
        activeJobId="job-1"
        outputs={[]}
        warnings={[]}
        selectedOutputs={new Set()}
        onToggleOutput={vi.fn()}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('1 / 2');
    await user.click(screen.getByRole('button', { name: 'utilities.cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('only enables pixel copy for one selected output and shows actionable feedback', async () => {
    const user = userEvent.setup();
    const onCopy = vi.fn();
    const { rerender } = render(
      <ToolResultStage
        progress={null}
        activeJobId={null}
        outputs={outputs}
        warnings={['a.jpg: profile converted; inspect color before delivery']}
        error="Disk full: free space and retry b.jpg"
        selectedOutputs={new Set()}
        onToggleOutput={vi.fn()}
        onCancel={vi.fn()}
        onCopy={onCopy}
      />,
    );

    expect(screen.getByRole('button', { name: 'utilities.copyImage' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Disk full');
    expect(screen.getByText(/profile converted/)).toBeInTheDocument();

    rerender(
      <ToolResultStage
        progress={null}
        activeJobId={null}
        outputs={outputs}
        warnings={[]}
        selectedOutputs={new Set(['/output/a-resized.jpg'])}
        onToggleOutput={vi.fn()}
        onCancel={vi.fn()}
        onCopy={onCopy}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'utilities.copyImage' }));
    expect(onCopy).toHaveBeenCalledWith('/output/a-resized.jpg');
  });

  it('reports zero savings as 0 KB instead of inventing 1 KB', () => {
    render(
      <ToolResultStage
        progress={null}
        activeJobId={null}
        outputs={[{ ...outputs[0], savingsBytes: -256 }]}
        warnings={[]}
        selectedOutputs={new Set()}
        onToggleOutput={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText('toolWorkflow.saved').nextElementSibling).toHaveTextContent('0 KB');
  });
});
