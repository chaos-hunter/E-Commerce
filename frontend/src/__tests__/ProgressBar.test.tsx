import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import '@testing-library/jest-dom'
import { DataIngestion } from "../DataIngestion";

const mockFetch = jest.fn();
const file = new File(['a,b'], 'test.csv', { type: 'text/csv' });

beforeEach(() => {
    global.fetch = mockFetch
    jest.useFakeTimers();
});

afterEach(() => {
    jest.clearAllTimers();
});

test('Progress bar is not visible on the upload screen', () => {
    render(<DataIngestion />);

    expect(screen.queryByText('Starting…')).not.toBeInTheDocument();
    expect(screen.queryByText(/rows/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
});

test('Progress bar updates correctly during upload and completes', async () => {
    render(<DataIngestion />);

    mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // upload
        .mockResolvedValueOnce({ ok: true, json: async () => ({ jobId: '1' }) }) // start job
        .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'RUNNING', progress: 0.5, processedCount: 500, totalCount: 1000, estimatedMillisRemaining: 4000 }) }) //Polling 1 at 50%
        .mockResolvedValueOnce({ok: true, json: async () => ({status: 'COMPLETED', progress: 1, processedCount: 1000, totalCount: 1000, estimatedMillisRemaining: 0})})//Polling 2 at 100%
        .mockResolvedValueOnce({ ok: true, json: async () => ({ entries: [], totalEntries: 0 }) }) //fetch results
        .mockResolvedValueOnce({ ok: true, json: async () => ({ entries: [], totalEntries: 0 }) })// invalid api
        .mockResolvedValueOnce({ ok: true, json: async () => ({ entries: [], totalEntries: 0 }) }); // dirty api

    const fileInput = screen.getByLabelText(/Select data file/i);
    fireEvent.change(fileInput, { target: { files: [file] } });

    fireEvent.click(screen.getByText(/Upload and Clean data/i));

    expect(await screen.findByText('Processing...')).toBeInTheDocument();

    jest.advanceTimersByTime(1000);

    await waitFor(() => {
        const expectedText = `${(500).toLocaleString()} / ${(1000).toLocaleString()} rows`;
        expect(screen.getByText(expectedText)).toBeInTheDocument();
        expect(screen.getByText('50%')).toBeInTheDocument();
        expect(screen.getByText(/~4s remaining/i)).toBeInTheDocument();
    });

    await waitFor(() => {
        const finalText = `${(1000).toLocaleString()} / ${(1000).toLocaleString()} rows`;
        expect(screen.getByText(finalText)).toBeInTheDocument();
        expect(screen.getByText('100%')).toBeInTheDocument();
});
});

test('Progress bar is not visible when View Existing Results is clicked', async () => {
    mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => ({ entries: [], totalEntries: 1 }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ entries: [], totalEntries: 0 }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ entries: [], totalEntries: 0 }) });

    render(<DataIngestion />);

    fireEvent.click(screen.getByText(/View Existing Results/i));

    await waitFor(() => {
        expect(screen.getByText('Processing...')).toBeInTheDocument();
    });

    expect(screen.queryByText('Starting…')).not.toBeInTheDocument();
    expect(screen.queryByText(/rows/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
});

test('Progress bar resets when a new upload is started after completion', async () => {   
    //first job
    mockFetch
        .mockResolvedValueOnce({ ok: true, text: async () => '' }) // upload
        .mockResolvedValueOnce({ ok: true, json: async () => ({ jobId: '1' }) }) // start job
        .mockResolvedValueOnce({ok: true, json: async () => ({status: 'COMPLETED', progress: 1, processedCount: 1000, totalCount: 1000, estimatedMillisRemaining: 0})})//Job status completion
        .mockResolvedValueOnce({ ok: true, json: async () => ({ entries: [], totalEntries: 0 }) }) //fetch results
        .mockResolvedValueOnce({ ok: true, json: async () => ({ entries: [], totalEntries: 0 }) })// invalid api
        .mockResolvedValueOnce({ ok: true, json: async () => ({ entries: [], totalEntries: 0 }) }) // dirty api
    
        //second job
        .mockResolvedValueOnce({ ok: true, text: async () => '' })//upload
        .mockResolvedValueOnce({ ok: true, json: async () => ({ jobId: '2' }) });//second job start
    
    render(<DataIngestion />);

    const fileInput = screen.getByLabelText(/Select data file/i);
    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.click(screen.getByText(/upload and clean data/i));
    
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2)); 
    jest.advanceTimersByTime(1000);

    await waitFor(() => {
        expect(screen.getByText(/Results/i)).toBeInTheDocument();
    }, { timeout: 5000 });

    //First job is completed, now start second job
    fireEvent.click(screen.getByText(/Start over/i));
    const newFileInput = screen.getByLabelText(/Select data file/i);
    fireEvent.change(newFileInput, { target: { files: [file] } });
    fireEvent.click(screen.getByText(/upload and Clean data/i));

    await waitFor(() => {
        expect(screen.getByText('Processing...')).toBeInTheDocument();
    });
    expect(screen.getByText('Starting…')).toBeInTheDocument();
    expect(screen.queryByText('Done')).not.toBeInTheDocument();
    expect(screen.queryByText('100%')).not.toBeInTheDocument();
});
