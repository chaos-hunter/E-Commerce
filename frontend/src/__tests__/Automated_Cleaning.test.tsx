import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import '@testing-library/jest-dom'
import { DataIngestion } from "../DataIngestion";

const mockFetch = jest.fn();
const mockCleanData = {
        entries: [{ invoice: '581492', stockCode: '22995', description: 'TRAVEL CARD WALLET SUKI', quantity: 4, price: 0.83, customerId: '' }],
        totalEntries: 1
    };

const file = new File(['a,b'], 'test.csv', { type: 'text/csv' });
const alert = jest.spyOn(window, 'alert');

beforeEach(() => {
    global.fetch = mockFetch
});

afterEach(() => {
    mockFetch.mockReset();
    jest.useFakeTimers();
});

test('Fetch upload API and Cleaning API', async () => {
    mockFetch
    .mockResolvedValueOnce({ ok: true, text: async() => ''})
    .mockResolvedValueOnce({ ok: true, json: async() =>({jobId: '1'}) })
    render(<DataIngestion />);

   fireEvent.change(screen.getByLabelText('Select Data File:'), { target: { files: [file] } });
   fireEvent.click(screen.getByText('Upload and Clean Data'))
    await waitFor(() => {
        // Assert upload now targets the RESTful ingest collection endpoint.
        expect(mockFetch).toHaveBeenNthCalledWith(1, '/api/ingests', expect.objectContaining({ method: 'POST'}))
        expect(mockFetch).toHaveBeenNthCalledWith(2, '/api/cleaning-jobs', expect.objectContaining({ method: 'POST'}))

    });
});


test('renders clean data after job completes', async () => {
    mockFetch
        .mockResolvedValueOnce({ ok: true, text: async() => ''})
        .mockResolvedValueOnce({ ok: true, json: async() =>({jobId: '1'}) })
        .mockResolvedValueOnce({ ok: true, json: async() =>({status: 'COMPLETED'}) })
        .mockResolvedValue({ok: true, json: async () => mockCleanData})

    render(<DataIngestion/>);
    fireEvent.change(screen.getByLabelText('Select Data File:'), { target: { files: [file] } })
    fireEvent.click(screen.getByText('Upload and Clean Data'))

    await waitFor(() => {
        expect(screen.getByText('581492')).toBeInTheDocument()
    } ,{timeout: 5000});

});

test('Shows error during cleaning job', async () => {

    mockFetch
        .mockResolvedValueOnce({ ok: true, text: async() => ''})
        .mockResolvedValueOnce({ ok: true, json: async() =>({jobId: '1'}) })
        .mockResolvedValueOnce({ ok: true, json: async() =>({status: 'FAILED'}) })

    render(<DataIngestion/>);
    fireEvent.change(screen.getByLabelText('Select Data File:'), { target: { files: [file] } })
    fireEvent.click(screen.getByText('Upload and Clean Data'))

    await waitFor(() => {
        expect(alert).toHaveBeenCalledWith('Cleaning job failed with status: FAILED')
    } ,{timeout: 5000});

});

test('Shows alert whenn no file is selected', async () => {
    render(<DataIngestion />);
    fireEvent.click(screen.getByText('Upload and Clean Data'));
    expect(alert).toHaveBeenCalledWith('Please select a file to upload first.');
});