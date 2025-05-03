import React, { useState } from 'react';

function SearchBox({ onSearch }) {
    const [inputValue, setInputValue] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (inputValue.trim()) {
            onSearch(inputValue.trim());
        }
    };

    return (
        <form onSubmit={handleSubmit} className="search-form">
            <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Enter UUID to find..."
                className="search-input"
                pattern="^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
                title="Enter a valid UUID (e.g., 550e8400-e29b-41d4-a716-446655440000)"
            />
            <button type="submit">Search</button>
        </form>
    );
}

export default SearchBox; 