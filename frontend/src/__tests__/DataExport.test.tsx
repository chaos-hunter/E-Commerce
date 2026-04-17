import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import '@testing-library/jest-dom'
import { DataIngestion } from "../DataIngestion";

const mockFetch = jest.fn();
const file = new File(['a,b'], 'test.csv', { type: 'text/csv' });
const alert = jest.spyOn(window, 'alert');

beforeEach(() => {
    global.fetch = mockFetch
    window.URL.createObjectURL = jest.fn(() => "blob:mock-url");
    window.URL.revokeObjectURL = jest.fn();
    jest.useFakeTimers();
});

afterEach(() => {
    mockFetch.mockReset();
    jest.clearAllTimers();
});

test('Upload and export data flow', async () => {
    mockFetch
    .mockResolvedValueOnce({ ok: true, text: async() => ''})
    .mockResolvedValueOnce({ ok: true, json: async() =>({jobId: '1'}) })
    .mockResolvedValueOnce({ ok: true, json: async() =>({status: 'COMPLETED'}) })
    .mockResolvedValueOnce({ok: true, json: async () => ({entries: [], totalEntries: 1})})
    .mockResolvedValueOnce({ok: true, json: async () => ({entries: [], totalEntries: 0})})
    .mockResolvedValueOnce({ok: true, json: async () => ({entries: [], totalEntries: 0})})
    .mockResolvedValueOnce({ok: true, blob: async () => new Blob(["excel-data"])});
    
    render(<DataIngestion />);

    const fileInput = screen.getByLabelText(/Select Data File/i);
    fireEvent.change(fileInput, {
        target: { files: [file] }
    });

    fireEvent.click(screen.getByText(/Upload and Clean Data/i));

    await waitFor(() => {
        expect(screen.getByText(/Results/i)).toBeInTheDocument();
        } ,{timeout: 5000});

    fireEvent.click(screen.getByText(/Download Cleaned Data/i));
    await waitFor(() => {expect(mockFetch).toHaveBeenCalledWith("/api/cleaning-data/cleaned?format=xlsx");
    } ,{timeout: 5000});
})
  
test('Show alert when no cleaned data available', async () => {
    mockFetch
    .mockResolvedValueOnce({ok: true, json: async () => ({ entries: [], totalEntries: 1 })})
    .mockResolvedValueOnce({ok: true, json: async () => ({ entries: [], totalEntries: 0 })})
    .mockResolvedValueOnce({ok: true, json: async () => ({ entries: [], totalEntries: 0 })})
    .mockResolvedValueOnce({ok: false, json: async () => ({message: "No cleaned data available to export."})});
    
    render(<DataIngestion />);

    fireEvent.click(screen.getByText(/View Existing Results/i));
    await waitFor(() => {
        expect(screen.getByText(/Results/i)).toBeInTheDocument();
        } ,{timeout: 5000});

    fireEvent.click(screen.getByText(/Download Cleaned Data/i));
    await waitFor(() => {expect(alert).toHaveBeenCalledWith("No cleaned data available to export.");
    } ,{timeout: 5000});
})