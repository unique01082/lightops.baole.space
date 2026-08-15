import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { MediaClient } from '../../lib/media-client';
import { UtilityWorkspace } from './utility-workspace';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const result = {
  jobId: 'job-1',
  status: 'completed' as const,
  warnings: [],
  outputs: [
    {
      sourcePath: '/photos/a.jpg',
      outputPath: '/output/a-resized.jpg',
      byteSize: 100,
      width: 1000,
      height: 750,
      savingsBytes: 200,
    },
    {
      sourcePath: '/photos/b.jpg',
      outputPath: '/output/b-resized.jpg',
      byteSize: 120,
      width: 1000,
      height: 750,
      savingsBytes: 180,
    },
  ],
};

async function runPreparedBatch(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'utilities.addImages' }));
  await user.click(screen.getByRole('button', { name: /toolWorkflow\.utility\.settings/ }));
  await user.click(screen.getByRole('button', { name: 'utilities.chooseOutput' }));
  await user.click(screen.getByRole('button', { name: /toolWorkflow\.utility\.review/ }));
  await user.click(screen.getByRole('button', { name: 'utilities.run' }));
}

describe('UtilityWorkspace', () => {
  it('guides a batch through Images, Settings, Review, and Results', async () => {
    const user = userEvent.setup();
    const client: MediaClient = {
      pickImages: vi.fn().mockResolvedValue(['/photos/a.jpg']),
      pickInputFolder: vi.fn().mockResolvedValue([]),
      pickOutputDirectory: vi.fn().mockResolvedValue('/output'),
      inspect: vi.fn().mockResolvedValue([]),
      runJob: vi.fn().mockResolvedValue(result),
      cancelJob: vi.fn(),
      copyOutputImage: vi.fn(),
    };

    render(<UtilityWorkspace toolId="resize" client={client} onBack={vi.fn()} />);
    const settings = screen.getByRole('button', { name: /toolWorkflow\.utility\.settings/ });
    const review = screen.getByRole('button', { name: /toolWorkflow\.utility\.review/ });
    expect(settings).toBeDisabled();
    expect(review).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'utilities.addImages' }));
    expect(settings).toBeEnabled();
    await user.click(settings);
    await user.click(screen.getByRole('button', { name: 'utilities.chooseOutput' }));
    expect(review).toBeEnabled();
    await user.click(review);
    expect(screen.getByText('toolWorkflow.utility.reviewTitle')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'utilities.run' }));
    expect(await screen.findByText('toolWorkflow.utility.resultsTitle')).toBeInTheDocument();
  });

  it('runs a resize batch and only copies one selected output', async () => {
    const user = userEvent.setup();
    const client: MediaClient = {
      pickImages: vi.fn().mockResolvedValue(['/photos/a.jpg', '/photos/b.jpg']),
      pickInputFolder: vi.fn().mockResolvedValue([]),
      pickOutputDirectory: vi.fn().mockResolvedValue('/output'),
      inspect: vi.fn().mockResolvedValue([]),
      runJob: vi.fn().mockResolvedValue(result),
      cancelJob: vi.fn(),
      copyOutputImage: vi.fn(),
    };

    render(<UtilityWorkspace toolId="resize" client={client} onBack={vi.fn()} />);
    await runPreparedBatch(user);

    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: /a-resized\.jpg/ })).toBeInTheDocument(),
    );
    const copy = screen.getByRole('button', { name: 'utilities.copyImage' });
    expect(copy).toBeDisabled();

    await user.click(screen.getByRole('checkbox', { name: /a-resized\.jpg/ }));
    expect(copy).toBeEnabled();
    await user.click(copy);
    expect(client.copyOutputImage).toHaveBeenCalledWith('/output/a-resized.jpg');
    expect(await screen.findByRole('status')).toHaveTextContent('utilities.copySucceeded');

    await user.click(screen.getByRole('checkbox', { name: /b-resized\.jpg/ }));
    expect(copy).toBeDisabled();
  });

  it('shows an actionable error when pixel copy fails', async () => {
    const user = userEvent.setup();
    const client: MediaClient = {
      pickImages: vi.fn().mockResolvedValue(['/photos/a.jpg']),
      pickInputFolder: vi.fn().mockResolvedValue([]),
      pickOutputDirectory: vi.fn().mockResolvedValue('/output'),
      inspect: vi.fn().mockResolvedValue([]),
      runJob: vi.fn().mockResolvedValue({ ...result, outputs: [result.outputs[0]] }),
      cancelJob: vi.fn(),
      copyOutputImage: vi.fn().mockRejectedValue(new Error('Clipboard unavailable')),
    };
    render(<UtilityWorkspace toolId="resize" client={client} onBack={vi.fn()} />);
    await runPreparedBatch(user);
    await user.click(await screen.findByRole('checkbox', { name: /a-resized\.jpg/ }));
    await user.click(screen.getByRole('button', { name: 'utilities.copyImage' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Clipboard unavailable');
  });

  it('multi-selects and removes batch inputs', async () => {
    const user = userEvent.setup();
    const client: MediaClient = {
      pickImages: vi.fn().mockResolvedValue(['/photos/a.jpg', '/photos/b.jpg']),
      pickInputFolder: vi.fn().mockResolvedValue([]),
      pickOutputDirectory: vi.fn().mockResolvedValue(null),
      inspect: vi.fn().mockResolvedValue([]),
      runJob: vi.fn(),
      cancelJob: vi.fn(),
      copyOutputImage: vi.fn(),
    };
    render(<UtilityWorkspace toolId="resize" client={client} onBack={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'utilities.addImages' }));
    await user.click(screen.getByRole('checkbox', { name: 'utilities.selectInput a.jpg' }));
    await user.click(screen.getByRole('button', { name: 'utilities.removeSelected' }));

    expect(screen.queryByText('/photos/a.jpg')).not.toBeInTheDocument();
    expect(screen.getByText('/photos/b.jpg')).toBeInTheDocument();
  });

  it('announces progress and lets the running job be cancelled', async () => {
    const user = userEvent.setup();
    let finishJob: ((value: typeof result) => void) | undefined;
    const client: MediaClient = {
      pickImages: vi.fn().mockResolvedValue(['/photos/a.jpg']),
      pickInputFolder: vi.fn().mockResolvedValue([]),
      pickOutputDirectory: vi.fn().mockResolvedValue('/output'),
      inspect: vi.fn().mockResolvedValue([]),
      runJob: vi.fn((_request, onProgress) => {
        onProgress?.({
          jobId: 'fixture-job',
          phase: 'processing',
          current: 0,
          total: 2,
          itemId: '/photos/a.jpg',
          messageKey: 'jobs.processing',
        });
        return new Promise<typeof result>((resolve) => {
          finishJob = resolve;
        });
      }),
      cancelJob: vi.fn().mockResolvedValue(undefined),
      copyOutputImage: vi.fn(),
    };
    render(<UtilityWorkspace toolId="resize" client={client} onBack={vi.fn()} />);
    await runPreparedBatch(user);

    expect(await screen.findByRole('status')).toHaveTextContent('1 / 2');
    await user.click(screen.getByRole('button', { name: 'utilities.cancel' }));
    expect(client.cancelJob).toHaveBeenCalledOnce();

    finishJob?.(result);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'utilities.cancel' })).not.toBeInTheDocument(),
    );
  });

  it('announces a job failure and preserves actionable per-file warnings', async () => {
    const user = userEvent.setup();
    const client: MediaClient = {
      pickImages: vi.fn().mockResolvedValue(['/photos/a.jpg']),
      pickInputFolder: vi.fn().mockResolvedValue([]),
      pickOutputDirectory: vi.fn().mockResolvedValue('/output'),
      inspect: vi.fn().mockResolvedValue([]),
      runJob: vi.fn().mockRejectedValue(new Error('Disk full: free space and retry a.jpg')),
      cancelJob: vi.fn(),
      copyOutputImage: vi.fn(),
    };
    render(<UtilityWorkspace toolId="resize" client={client} onBack={vi.fn()} />);
    await runPreparedBatch(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Disk full: free space and retry a.jpg',
    );
  });
});
