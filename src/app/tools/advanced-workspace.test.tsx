import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { AdvancedClient } from '../../lib/advanced-client';
import { AdvancedWorkspace } from './advanced-workspace';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function createClient(): AdvancedClient {
  return {
    pickImages: vi.fn().mockResolvedValue(['/photos/a.jpg', '/photos/b.jpg']),
    pickInputFolder: vi.fn().mockResolvedValue([]),
    pickOutputDirectory: vi.fn().mockResolvedValue('/output'),
    analyzeSequences: vi.fn().mockResolvedValue([
      {
        id: 'sequence-1',
        kind: 'hdr',
        confidence: 0.92,
        paths: ['/photos/a.jpg', '/photos/b.jpg'],
        evidence: ['Exposure changes'],
        excluded: false,
      },
    ]),
    exportSequences: vi.fn().mockResolvedValue('/output/lightops-sequences.json'),
    auditMetadata: vi.fn().mockResolvedValue([]),
    cleanMetadata: vi.fn().mockResolvedValue({ outputs: [], warnings: [] }),
    suggestPairs: vi.fn().mockResolvedValue([]),
    exportBeforeAfter: vi.fn().mockResolvedValue({ outputs: [], warnings: [] }),
    cancelJob: vi.fn().mockResolvedValue(undefined),
  };
}

describe('AdvancedWorkspace', () => {
  it('gates the Sequence flow from Images through Analyze, Review, and Export', async () => {
    const user = userEvent.setup();
    const client = createClient();
    render(<AdvancedWorkspace toolId="sequence_grouper" client={client} onBack={vi.fn()} />);

    const analyzeStep = screen.getByRole('button', {
      name: /toolWorkflow\.advanced\.sequence\.analyze/,
    });
    const reviewStep = screen.getByRole('button', {
      name: /toolWorkflow\.advanced\.sequence\.review/,
    });
    expect(analyzeStep).toBeDisabled();
    expect(reviewStep).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'advancedTools.addImages' }));
    expect(analyzeStep).toBeEnabled();
    await user.click(analyzeStep);
    await user.click(screen.getByRole('button', { name: 'advancedTools.analyze' }));
    expect(await screen.findByText('HDR · 92%')).toBeInTheDocument();
    expect(screen.getByText('toolWorkflow.advanced.sequence.reviewTitle')).toBeInTheDocument();
  });

  it('reviews and exports sequence groups without changing sources', async () => {
    const user = userEvent.setup();
    const client = createClient();
    render(<AdvancedWorkspace toolId="sequence_grouper" client={client} onBack={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'advancedTools.addImages' }));
    await user.click(
      screen.getByRole('button', { name: /toolWorkflow\.advanced\.sequence\.analyze/ }),
    );
    await user.click(screen.getByRole('button', { name: 'advancedTools.analyze' }));
    expect(await screen.findByText('HDR · 92%')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'advancedTools.removeImage a.jpg' }));
    expect(
      screen.queryByRole('button', { name: 'advancedTools.removeImage a.jpg' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'advancedTools.removeImage b.jpg' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: /toolWorkflow\.advanced\.export/ }));
    await user.click(screen.getByRole('button', { name: 'advancedTools.chooseOutput' }));
    await user.click(screen.getByRole('button', { name: 'advancedTools.export' }));
    expect(client.exportSequences).toHaveBeenCalledWith('/output', expect.any(Array));
  });

  it('preselects the five Safe Share metadata categories', async () => {
    const user = userEvent.setup();
    render(
      <AdvancedWorkspace toolId="metadata_cleaner" client={createClient()} onBack={vi.fn()} />,
    );
    await user.click(screen.getByRole('button', { name: 'advancedTools.addImages' }));
    await user.click(
      screen.getByRole('button', { name: /toolWorkflow\.advanced\.metadata\.audit/ }),
    );
    await user.click(screen.getByRole('button', { name: 'advancedTools.analyze' }));
    expect(screen.getAllByRole('checkbox', { checked: true })).toHaveLength(5);
  });

  it('requires analysis before advanced exports can run', async () => {
    const user = userEvent.setup();
    const client = createClient();
    client.auditMetadata = vi.fn().mockResolvedValue([
      {
        path: '/photos/a.jpg',
        tags: { 'EXIF:GPSLatitude': '10.7', 'EXIF:Copyright': 'Bao Le' },
        safeShareCategories: ['location'],
      },
    ]);
    render(<AdvancedWorkspace toolId="metadata_cleaner" client={client} onBack={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'advancedTools.addImages' }));
    const resultsStep = screen.getByRole('button', { name: /toolWorkflow\.advanced\.results/ });
    expect(resultsStep).toBeDisabled();
    await user.click(
      screen.getByRole('button', { name: /toolWorkflow\.advanced\.metadata\.audit/ }),
    );

    await user.click(screen.getByRole('button', { name: 'advancedTools.analyze' }));
    expect(await screen.findByText('EXIF:GPSLatitude')).toBeInTheDocument();
    expect(resultsStep).toBeEnabled();
    await user.click(resultsStep);
    await user.click(screen.getByRole('button', { name: 'advancedTools.chooseOutput' }));
    expect(screen.getByRole('button', { name: 'advancedTools.export' })).toBeEnabled();
  });

  it('allows a before/after pair to be reassigned by drag and drop', async () => {
    const user = userEvent.setup();
    const client = createClient();
    client.suggestPairs = vi.fn().mockResolvedValue([
      {
        id: 'pair-1',
        beforePath: '/photos/a.jpg',
        afterPath: '/photos/b.jpg',
        confidence: 0.9,
        evidence: ['Filename match'],
      },
    ]);
    render(<AdvancedWorkspace toolId="before_after" client={client} onBack={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'advancedTools.addImages' }));
    await user.click(
      screen.getByRole('button', { name: /toolWorkflow\.advanced\.beforeAfter\.pair/ }),
    );
    await user.click(screen.getByRole('button', { name: 'advancedTools.analyze' }));

    const transfer = {
      setData: vi.fn(),
      getData: vi.fn().mockReturnValue('/photos/a.jpg'),
    };
    fireEvent.dragStart(screen.getByLabelText('advancedTools.dragImage a.jpg'), {
      dataTransfer: transfer,
    });
    fireEvent.drop(screen.getByLabelText('advancedTools.dropAfter pair-1'), {
      dataTransfer: transfer,
    });

    expect(transfer.setData).toHaveBeenCalledWith('text/lightops-path', '/photos/a.jpg');
    expect(screen.getByLabelText('advancedTools.after pair-1')).toHaveValue('/photos/a.jpg');
  });

  it('shows analysis failures inline on the step where they happen', async () => {
    const user = userEvent.setup();
    const client = createClient();
    client.analyzeSequences = vi
      .fn()
      .mockRejectedValue(new Error('corrupt.jpg: cannot decode image; remove it and retry'));
    render(<AdvancedWorkspace toolId="sequence_grouper" client={client} onBack={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'advancedTools.addImages' }));
    await user.click(
      screen.getByRole('button', { name: /toolWorkflow\.advanced\.sequence\.analyze/ }),
    );
    await user.click(screen.getByRole('button', { name: 'advancedTools.analyze' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('corrupt.jpg');
  });

  it('does not preselect video formats when the packaged encoder is unavailable', async () => {
    const user = userEvent.setup();
    const client = createClient();
    client.suggestPairs = vi.fn().mockResolvedValue([
      {
        id: 'pair-1',
        beforePath: '/photos/a.jpg',
        afterPath: '/photos/b.jpg',
        confidence: 0.9,
        evidence: ['Filename match'],
      },
    ]);
    render(<AdvancedWorkspace toolId="before_after" client={client} onBack={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'advancedTools.addImages' }));
    await user.click(
      screen.getByRole('button', { name: /toolWorkflow\.advanced\.beforeAfter\.pair/ }),
    );
    await user.click(screen.getByRole('button', { name: 'advancedTools.analyze' }));
    await user.click(screen.getByRole('button', { name: 'toolWorkflow.continue' }));

    expect(screen.getByRole('checkbox', { name: 'mp4' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'gif' })).not.toBeChecked();
  });
});
