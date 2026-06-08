import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function CaseCreator() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [caseName, setCaseName] = useState('');
    const [caseImageFile, setCaseImageFile] = useState(null);
    const [items, setItems] = useState([
        { id: 1, name: '', value: '', odds: '', imageFile: null }
    ]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!user) {
        return <div style={{ padding: '20px' }}>Please log in to create cases.</div>;
    }

    const handleItemChange = (id, field, value) => {
        setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const addItem = () => {
        setItems([...items, { id: Date.now(), name: '', value: '', odds: '', imageFile: null }]);
    };

    const removeItem = (id) => {
        setItems(items.filter(item => item.id !== id));
    };

    const uploadFile = async (file) => {
        const formData = new FormData();
        formData.append('image', file);
        const token = localStorage.getItem('token');
        const res = await axios.post('/api/upload', formData, {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'multipart/form-data'
            }
        });
        return res.data.url;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const totalOdds = items.reduce((acc, curr) => acc + parseFloat(curr.odds || 0), 0);
            if (Math.abs(totalOdds - 100) > 0.01) {
                throw new Error(`Total odds must be exactly 100%. Currently: ${totalOdds}%`);
            }

            if (!caseImageFile) throw new Error('Please upload a case image.');

            // 1. Upload Case Image
            const caseImageUrl = await uploadFile(caseImageFile);

            // 2. Upload Item Images
            const uploadedItems = [];
            for (const item of items) {
                if (!item.name || !item.value || !item.odds) throw new Error('All item fields are required.');
                if (!item.imageFile) throw new Error(`Please upload an image for item: ${item.name}`);
                
                const itemImageUrl = await uploadFile(item.imageFile);
                uploadedItems.push({
                    name: item.name,
                    value: parseFloat(item.value),
                    odds: parseFloat(item.odds),
                    imageUrl: itemImageUrl
                });
            }

            // 3. Submit Case Data
            const token = localStorage.getItem('token');
            const res = await axios.post('/api/cases', {
                name: caseName,
                imageUrl: caseImageUrl,
                items: uploadedItems
            }, { headers: { 'Authorization': `Bearer ${token}` } });

            alert(`Case created! Calculated Price: ${res.data.price.toFixed(2)} Gems`);
            navigate('/cases');
            
        } catch (err) {
            const errorMsg = err.response?.data?.error || err.message || 'Error creating case';
            const details = err.response?.data?.details;
            alert(details ? `${errorMsg}\n\nDetails: ${details}` : errorMsg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const expectedReturn = items.reduce((acc, curr) => acc + (parseFloat(curr.value || 0) * (parseFloat(curr.odds || 0) / 100)), 0);
    const calculatedPrice = expectedReturn / 0.99;
    const totalOdds = items.reduce((acc, curr) => acc + parseFloat(curr.odds || 0), 0);

    return (
        <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
            <h1 style={{ color: 'var(--accent-gold)', marginBottom: '20px' }}>CASE CREATOR</h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: '30px' }}>
                Create your own custom case! The system will automatically calculate the case price to ensure an exact 99% Expected Value (EV). You get 1% of the price every time someone opens it! Max image size: 50MB (will be auto-compressed).
            </p>

            <form onSubmit={handleSubmit}>
                <div style={{ backgroundColor: '#1e1e1e', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #333' }}>
                    <h3>Case Details</h3>
                    <input 
                        type="text" placeholder="Case Name" className="input-field" style={{ marginTop: '15px' }}
                        value={caseName} onChange={e => setCaseName(e.target.value)} required
                    />
                    <div style={{ marginTop: '10px' }}>
                        <label>Case Image: </label>
                        <input type="file" accept="image/*, .jfif, .webp" onChange={e => setCaseImageFile(e.target.files[0])} required />
                    </div>
                </div>

                <div style={{ backgroundColor: '#1e1e1e', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #333' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3>Items Inside</h3>
                        <button type="button" className="btn-secondary" onClick={addItem}>+ Add Item</button>
                    </div>

                    {items.map((item, index) => (
                        <div key={item.id} style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '15px', backgroundColor: '#0a0a0a', padding: '10px', borderRadius: '4px' }}>
                            <div style={{ flex: 1 }}>
                                <input type="text" placeholder="Item Name" className="input-field" style={{ marginBottom: '10px' }} value={item.name} onChange={e => handleItemChange(item.id, 'name', e.target.value)} required />
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <input type="number" placeholder="Value (Gems)" className="input-field" style={{ marginBottom: 0 }} value={item.value} onChange={e => handleItemChange(item.id, 'value', e.target.value)} required min="0" step="0.01" />
                                    <input type="number" placeholder="Odds (%)" className="input-field" style={{ marginBottom: 0 }} value={item.odds} onChange={e => handleItemChange(item.id, 'odds', e.target.value)} required min="0" max="100" step="0.001" />
                                </div>
                                <div style={{ marginTop: '10px' }}>
                                    <input type="file" accept="image/*, .jfif, .webp" onChange={e => handleItemChange(item.id, 'imageFile', e.target.files[0])} required />
                                </div>
                            </div>
                            {items.length > 1 && (
                                <button type="button" onClick={() => removeItem(item.id)} style={{ backgroundColor: '#F44336', color: '#fff', padding: '10px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}>X</button>
                            )}
                        </div>
                    ))}
                </div>

                <div style={{ backgroundColor: '#1e1e1e', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #333' }}>
                    <h3>Math Summary</h3>
                    <div style={{ marginTop: '10px', color: totalOdds === 100 ? 'var(--accent-green)' : '#F44336' }}>
                        Total Odds: {totalOdds.toFixed(2)}% (Must be 100%)
                    </div>
                    <div style={{ marginTop: '5px' }}>
                        Expected Return per Open: {expectedReturn.toFixed(2)} Gems
                    </div>
                    <div style={{ marginTop: '5px', fontWeight: 'bold', color: 'var(--accent-gold)' }}>
                        Calculated Case Price (EV / 0.99): {isNaN(calculatedPrice) ? '0.00' : calculatedPrice.toFixed(2)} Gems
                    </div>
                    <div style={{ marginTop: '5px', color: 'var(--accent-green)' }}>
                        Your Profit per Open: {isNaN(calculatedPrice) ? '0.00' : (calculatedPrice * 0.01).toFixed(2)} Gems
                    </div>
                </div>

                <button type="submit" className="btn-primary" style={{ width: '100%', height: '50px', fontSize: '18px' }} disabled={isSubmitting}>
                    {isSubmitting ? 'Uploading & Creating...' : 'Publish Case'}
                </button>
            </form>
        </div>
    );
}
