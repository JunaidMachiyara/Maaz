import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../context/DataContext.tsx';
import { 
    OriginalPurchased, Currency, JournalEntry, JournalEntryType, UserProfile, AppState 
} from '../types.ts';
import { generateOriginalPurchaseId } from '../utils/idGenerator.ts';
import CurrencyInput from './ui/CurrencyInput.tsx';
import Modal from './ui/Modal.tsx';
import EntitySelector from './ui/EntitySelector.tsx';
import StockLotPurchaseForm from './StockLotPurchaseForm.tsx'; 

// --- Reusable Helper Components ---
const CollapsibleSection: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, children, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="border rounded-md bg-slate-50/50">
            <button
                type="button"
                className="w-full flex justify-between items-center p-3 bg-slate-100 hover:bg-slate-200 transition-colors rounded-t-md"
                onClick={() => setIsOpen(!isOpen)}
            >
                <h4 className="font-semibold text-slate-700">{title}</h4>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-slate-500 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {isOpen && <div className="p-4 space-y-4">{children}</div>}
        </div>
    );
};

// --- Main Purchases Module ---
type PurchaseView = 'original' | 'finishedGoods';

interface PurchasesModuleProps {
    showNotification: (msg: string) => void;
    userProfile: UserProfile | null;
    onOpenSetup: (target: string) => void;
}

const PurchasesModule: React.FC<PurchasesModuleProps> = ({ showNotification, userProfile, onOpenSetup }) => {
    const [view, setView] = useState<PurchaseView>('original');

    const getButtonClass = (v: PurchaseView) => 
        `px-4 py-2 rounded-md transition-colors text-sm font-medium ${view === v ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`;
    
    return (
        <div className="space-y-6">
            <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold text-slate-700 mr-4">New Purchase</h2>
                <button onClick={() => setView('original')} className={getButtonClass('original')}>Original Purchase</button>
                <button onClick={() => setView('finishedGoods')} className={getButtonClass('finishedGoods')}>Finished Goods</button>
            </div>

            <div>
                {view === 'original' && <OriginalPurchaseFormInternal showNotification={showNotification} userProfile={userProfile} onOpenSetup={onOpenSetup} />}
                {view === 'finishedGoods' && <StockLotPurchaseForm showNotification={showNotification} userProfile={userProfile} />}
            </div>
        </div>
    );
};

const OriginalPurchaseSummaryModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    purchase: OriginalPurchased;
    state: AppState;
    hasPrinted: boolean;
    setHasPrinted: (p: boolean) => void;
}> = ({ isOpen, onClose, onSave, purchase, state, hasPrinted, setHasPrinted }) => {
    const handlePrint = () => { window.print(); setHasPrinted(true); };
    const supplier = state.suppliers.find(s => s.id === purchase.supplierId);
    const originalType = state.originalTypes.find(ot => ot.id === purchase.originalTypeId);

    const itemValueUSD = (purchase.quantityPurchased * purchase.rate) * purchase.conversionRate;
    const freightValueUSD = (purchase.freightAmount || 0) * (purchase.freightConversionRate || 1);
    const clearingValueUSD = (purchase.clearingAmount || 0) * (purchase.clearingConversionRate || 1);
    const commissionValueUSD = (purchase.commissionAmount || 0) * (purchase.commissionConversionRate || 1);
    
    const totalAdditionalCosts = freightValueUSD + clearingValueUSD + commissionValueUSD;
    const grandTotalUSD = itemValueUSD + totalAdditionalCosts + (purchase.discountSurcharge || 0);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Original Purchase Summary" size="4xl">
            <div id="original-purchase-voucher-content" className="p-4 bg-white font-sans text-sm">
                <h2 className="text-xl font-bold text-center text-slate-900">Original Purchase Voucher</h2>
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 mt-4 border-b pb-2 text-slate-700">
                    <p><strong>Date:</strong> {purchase.date}</p>
                    <p><strong>Supplier:</strong> {supplier?.name}</p>
                    <p><strong>Batch No:</strong> {purchase.batchNumber}</p>
                    <p><strong>Container No:</strong> {purchase.containerNumber || 'N/A'}</p>
                </div>
                <table className="w-full text-left my-4">
                    <thead className="border-b"><tr className="bg-slate-50"><th className="p-1 font-semibold text-slate-800">Description</th><th className="p-1 font-semibold text-slate-800 text-right">Qty</th><th className="p-1 font-semibold text-slate-800 text-right">Rate ({purchase.currency})</th><th className="p-1 font-semibold text-slate-800 text-right">Total ({purchase.currency})</th></tr></thead>
                    <tbody>
                        <tr>
                            <td className="p-1 text-slate-800">{originalType?.name}</td>
                            <td className="p-1 text-right text-slate-800">{purchase.quantityPurchased.toLocaleString()}</td>
                            <td className="p-1 text-right text-slate-800">{purchase.rate.toFixed(2)}</td>
                            <td className="p-1 text-right text-slate-800">{(purchase.quantityPurchased * purchase.rate).toFixed(2)}</td>
                        </tr>
                    </tbody>
                    <tfoot>
                        <tr className="font-bold border-t"><td colSpan={3} className="p-1 text-right text-slate-800">Subtotal (USD)</td><td className="p-1 text-right text-slate-800">${itemValueUSD.toFixed(2)}</td></tr>
                    </tfoot>
                </table>
                
                <div className="mt-2 space-y-1 text-xs text-slate-700">
                    {purchase.freightAmount && <div className="flex justify-between"><span>Freight</span><span>${freightValueUSD.toFixed(2)}</span></div>}
                    {purchase.clearingAmount && <div className="flex justify-between"><span>Clearing</span><span>${clearingValueUSD.toFixed(2)}</span></div>}
                    {purchase.commissionAmount && <div className="flex justify-between"><span>Commission</span><span>${commissionValueUSD.toFixed(2)}</span></div>}
                    {purchase.discountSurcharge && <div className="flex justify-between"><span>Discount/Surcharge</span><span>${purchase.discountSurcharge.toFixed(2)}</span></div>}
                </div>

                <div className="text-right font-bold text-lg bg-slate-100 p-2 rounded-md mt-4 text-slate-900">
                    Grand Total (USD): ${grandTotalUSD.toFixed(2)}
                </div>
            </div>
            <div className="flex justify-end pt-6 space-x-2 no-print">
                <button onClick={onClose} className="px-4 py-2 bg-slate-200 text-slate-800 rounded-md hover:bg-slate-300">
                    {hasPrinted ? 'Cancel Entry' : 'Cancel'}
                </button>
                <button onClick={handlePrint} disabled={hasPrinted} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-indigo-300">
                    Print
                </button>
                <button onClick={onSave} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                    {hasPrinted ? 'Save & Exit' : 'Save & Download PDF'}
                </button>
            </div>
        </Modal>
    );
};

const OriginalPurchaseFormInternal: React.FC<PurchasesModuleProps> = ({ showNotification, userProfile, onOpenSetup }) => {
    const { state, dispatch } = useData();
    const getInitialState = () => {
        const allBatchNumbers = [
            ...state.originalPurchases.map(p => p.batchNumber),
            ...state.finishedGoodsPurchases.map(p => p.batchNumber)
        ];

        const lastNumericBatch = allBatchNumbers
            .filter(bn => bn && /^\d+$/.test(bn))
            .map(bn => parseInt(bn!, 10))
            .sort((a, b) => b - a)[0];

        const newBatchNumber = lastNumericBatch ? String(lastNumericBatch + 1) : '101';

        return {
            date: new Date().toISOString().split('T')[0], supplierId: '', originalTypeId: '', quantityPurchased: '',
            rate: '',
            currency: Currency.Dollar, conversionRate: 1, divisionId: '', subDivisionId: '',
            batchNumber: newBatchNumber, containerNumber: '', discountSurcharge: '', 
            freightForwarderId: '', freightAmount: '',
            clearingAgentId: '', clearingAmount: '', 
            commissionAgentId: '', commissionAmount: '',
            subSupplierId: '',
            originalProductId: '',
        };
    };

    const [formData, setFormData] = useState(getInitialState());
    const [freightCurrencyData, setFreightCurrencyData] = useState({ currency: Currency.Dollar, conversionRate: 1 });
    const [clearingCurrencyData, setClearingCurrencyData] = useState({ currency: Currency.Dollar, conversionRate: 1 });
    const [commissionCurrencyData, setCommissionCurrencyData] = useState({ currency: Currency.Dollar, conversionRate: 1 });

    const [purchaseToSave, setPurchaseToSave] = useState<OriginalPurchased | null>(null);
    const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
    const [hasPrinted, setHasPrinted] = useState(false);
    const [containerError, setContainerError] = useState<string | null>(null);

    const availableSubDivisions = useMemo(() => {
        if (!formData.divisionId) return [];
        return state.subDivisions.filter(sd => sd.divisionId === formData.divisionId);
    }, [formData.divisionId, state.subDivisions]);
    
    const availableSubSuppliers = useMemo(() => {
        if (!formData.supplierId) return [];
        return state.subSuppliers.filter(ss => ss.supplierId === formData.supplierId);
    }, [formData.supplierId, state.subSuppliers]);

    const availableOriginalProducts = useMemo(() => {
        if (!formData.originalTypeId) return [];
        return state.originalProducts.filter(op => op.originalTypeId === formData.originalTypeId);
    }, [formData.originalTypeId, state.originalProducts]);

    useEffect(() => {
        const supplier = state.suppliers.find(s => s.id === formData.supplierId);
        if (supplier) {
            setFormData(prev => ({ ...prev, currency: supplier.defaultCurrency || Currency.Dollar, conversionRate: 1 }));
        }
    }, [formData.supplierId, state.suppliers]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFinalizePurchase = () => {
        if (!formData.supplierId || !formData.originalTypeId || !formData.quantityPurchased || !formData.rate) {
            showNotification("Please fill all required fields (Supplier, Type, Quantity, Rate).");
            return;
        }

        if (formData.containerNumber && formData.containerNumber.trim() !== '') {
            const trimmedContainerNumber = formData.containerNumber.trim().toLowerCase();
            const isDuplicateInOriginals = state.originalPurchases.some(p => p.containerNumber && p.containerNumber.trim().toLowerCase() === trimmedContainerNumber);
            const isDuplicateInFinished = state.finishedGoodsPurchases.some(p => p.containerNumber && p.containerNumber.trim().toLowerCase() === trimmedContainerNumber);

            if (isDuplicateInOriginals || isDuplicateInFinished) {
                setContainerError(`DUPLICATE CONTAINER: The container number "${formData.containerNumber}" is already in use. Please enter a different one.`);
                return;
            }
        }
        
        const supplier = state.suppliers.find(s => s.id === formData.supplierId);
        const purchaseId = generateOriginalPurchaseId(state.nextOriginalPurchaseNumber, formData.date, supplier?.name || 'Unknown');

        const fullPurchase: OriginalPurchased = {
            id: purchaseId,
            date: formData.date,
            supplierId: formData.supplierId,
            subSupplierId: formData.subSupplierId || undefined,
            originalTypeId: formData.originalTypeId,
            originalProductId: formData.originalProductId || undefined,
            quantityPurchased: Number(formData.quantityPurchased),
            rate: Number(formData.rate),
            currency: formData.currency,
            conversionRate: formData.conversionRate,
            batchNumber: formData.batchNumber,
            containerNumber: formData.containerNumber,
            divisionId: formData.divisionId,
            subDivisionId: formData.subDivisionId,
            discountSurcharge: Number(formData.discountSurcharge) || undefined,
            
            freightForwarderId: formData.freightForwarderId,
            freightAmount: Number(formData.freightAmount) || undefined,
            freightCurrency: freightCurrencyData.currency,
            freightConversionRate: freightCurrencyData.conversionRate,
            
            clearingAgentId: formData.clearingAgentId,
            clearingAmount: Number(formData.clearingAmount) || undefined,
            clearingCurrency: clearingCurrencyData.currency,
            clearingConversionRate: clearingCurrencyData.conversionRate,
            
            commissionAgentId: formData.commissionAgentId,
            commissionAmount: Number(formData.commissionAmount) || undefined,
            commissionCurrency: commissionCurrencyData.currency,
            commissionConversionRate: commissionCurrencyData.conversionRate,
        };

        setPurchaseToSave(fullPurchase);
        setHasPrinted(false);
        setIsSummaryModalOpen(true);
    };

    const handleSaveAndContinue = () => {
        if (!purchaseToSave) return;
        
        dispatch({ type: 'ADD_ENTITY', payload: { entity: 'originalPurchases', data: purchaseToSave } });
        
        const jeDate = purchaseToSave.date;
        const supplierName = state.suppliers.find(s => s.id === purchaseToSave.supplierId)?.name || 'N/A';
        const baseDescription = `Original Purchase from ${supplierName}`;
        
        const itemValueUSD = (purchaseToSave.quantityPurchased * purchaseToSave.rate) * purchaseToSave.conversionRate + (purchaseToSave.discountSurcharge || 0);
        
        const purchaseDebit: JournalEntry = { id: `je-d-op-${purchaseToSave.id}`, voucherId: `JV-${purchaseToSave.id}`, date: jeDate, entryType: JournalEntryType.Journal, account: 'EXP-004', debit: itemValueUSD, credit: 0, description: baseDescription };
        const supplierCredit: JournalEntry = { id: `je-c-op-${purchaseToSave.id}`, voucherId: `JV-${purchaseToSave.id}`, date: jeDate, entryType: JournalEntryType.Journal, account: 'AP-001', debit: 0, credit: itemValueUSD, description: baseDescription, entityId: purchaseToSave.supplierId, entityType: 'supplier' };
        
        dispatch({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: purchaseDebit }});
        dispatch({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: supplierCredit }});

         const costs = [
            { type: 'Freight', id: purchaseToSave.freightForwarderId, amount: purchaseToSave.freightAmount, currencyData: freightCurrencyData, account: 'EXP-005', entityType: 'freightForwarder' as const, name: state.freightForwarders.find(f=>f.id===purchaseToSave.freightForwarderId)?.name },
            { type: 'Clearing', id: purchaseToSave.clearingAgentId, amount: purchaseToSave.clearingAmount, currencyData: clearingCurrencyData, account: 'EXP-006', entityType: 'clearingAgent' as const, name: state.clearingAgents.find(f=>f.id===purchaseToSave.clearingAgentId)?.name },
            { type: 'Commission', id: purchaseToSave.commissionAgentId, amount: purchaseToSave.commissionAmount, currencyData: commissionCurrencyData, account: 'EXP-008', entityType: 'commissionAgent' as const, name: state.commissionAgents.find(f=>f.id===purchaseToSave.commissionAgentId)?.name },
        ];
        
        costs.forEach(cost => {
            if (cost.id && (cost.amount || 0) > 0) {
                const costValueUSD = (cost.amount || 0) * cost.currencyData.conversionRate;
                const costDesc = `${cost.type} for INV ${purchaseToSave.id} from ${cost.name}`;
                const debit: JournalEntry = { id: `je-d-${cost.type.toLowerCase()}-${purchaseToSave.id}`, voucherId: `JV-${purchaseToSave.id}`, date: jeDate, entryType: JournalEntryType.Journal, account: cost.account, debit: costValueUSD, credit: 0, description: costDesc };
                const credit: JournalEntry = { id: `je-c-${cost.type.toLowerCase()}-${purchaseToSave.id}`, voucherId: `JV-${purchaseToSave.id}`, date: jeDate, entryType: JournalEntryType.Journal, account: 'AP-001', debit: 0, credit: costValueUSD, description: costDesc, entityId: cost.id, entityType: cost.entityType };
                dispatch({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: debit }});
                dispatch({ type: 'ADD_ENTITY', payload: { entity: 'journalEntries', data: credit }});
            }
        });
        
        showNotification('Original Purchase Saved!');
        setFormData(getInitialState());
        setIsSummaryModalOpen(false);
        setPurchaseToSave(null);
    };

    const isFreightDisabled = !formData.freightForwarderId;
    const isClearingDisabled = !formData.clearingAgentId;
    const isCommissionDisabled = !formData.commissionAgentId;
    const inputClasses = "mt-1 w-full p-2 rounded-md";

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end p-4 border rounded-lg bg-white">
                <div>
                    <label className="block text-sm font-medium text-slate-700">Date</label>
                    <input type="date" name="date" value={formData.date} onChange={handleChange} required className={inputClasses}/>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700">Supplier</label>
                    <div className="flex space-x-1">
                        <EntitySelector
                            entities={state.suppliers}
                            selectedEntityId={formData.supplierId}
                            onSelect={(id) => setFormData(prev => ({ ...prev, supplierId: id }))}
                            placeholder="Search Suppliers..."
                        />
                        <button type="button" onClick={() => onOpenSetup('suppliers')} className="text-blue-600 hover:text-blue-800 font-bold px-2">+</button>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700">Sub-Supplier</label>
                    <select name="subSupplierId" value={formData.subSupplierId} onChange={handleChange} disabled={!formData.supplierId} className={inputClasses}>
                        <option value="">None / Direct</option>
                        {availableSubSuppliers.map(ss => <option key={ss.id} value={ss.id}>{ss.name}</option>)}
                    </select>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700">Batch Number</label>
                    <input type="text" name="batchNumber" value={formData.batchNumber} onChange={handleChange} className={inputClasses} />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end p-4 border rounded-lg bg-white">
                <div>
                    <label className="block text-sm font-medium text-slate-700">Original Type</label>
                    <div className="flex space-x-1">
                        <select name="originalTypeId" value={formData.originalTypeId} onChange={handleChange} className={inputClasses}>
                            <option value="">Select Type</option>
                            {state.originalTypes.map(ot => <option key={ot.id} value={ot.id}>{ot.name}</option>)}
                        </select>
                        <button type="button" onClick={() => onOpenSetup('originalTypes')} className="text-blue-600 hover:text-blue-800 font-bold px-2">+</button>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700">Original Product</label>
                    <select name="originalProductId" value={formData.originalProductId} onChange={handleChange} disabled={!formData.originalTypeId} className={inputClasses}>
                        <option value="">None</option>
                        {availableOriginalProducts.map(op => <option key={op.id} value={op.id}>{op.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700">Quantity Purchased</label>
                    <input type="number" name="quantityPurchased" value={formData.quantityPurchased} onChange={handleChange} className={inputClasses} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700">Rate</label>
                    <input type="number" name="rate" step="0.01" value={formData.rate} onChange={handleChange} className={inputClasses} />
                </div>
                <div className="md:col-span-1">
                    <label className="block text-sm font-medium text-slate-700">Currency & Rate</label>
                    <CurrencyInput value={{currency: formData.currency, conversionRate: formData.conversionRate}} onChange={(val) => setFormData(p => ({...p, ...val}))} />
                </div>
            </div>

             <div className="border rounded-lg p-4 bg-white">
                <h3 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">Logistics & Destination</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div><label className="block text-sm font-medium text-slate-700">Container #</label><input type="text" name="containerNumber" value={formData.containerNumber} onChange={handleChange} className={`${inputClasses}`}/></div>
                    <div><label className="block text-sm font-medium text-slate-700">Division</label><select name="divisionId" value={formData.divisionId} onChange={handleChange} className={`${inputClasses}`}><option value="">Select Division</option>{state.divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
                    <div><label className="block text-sm font-medium text-slate-700">Sub Division</label><select name="subDivisionId" value={formData.subDivisionId} onChange={handleChange} disabled={!formData.divisionId || availableSubDivisions.length === 0} className={`${inputClasses}`}><option value="">Select Sub-Division</option>{availableSubDivisions.map(sd => <option key={sd.id} value={sd.id}>{sd.name}</option>)}</select></div>
                    <div><label className="block text-sm font-medium text-slate-700">Discount(-) / Surcharge(+)</label><input type="number" name="discountSurcharge" step="0.01" value={formData.discountSurcharge} onChange={handleChange} className={`${inputClasses}`} placeholder="Amount in USD"/></div>
                </div>
            </div>

            <div className="border rounded-lg p-4 bg-white">
                <h3 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">Additional Cost</h3>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">Freight Forwarder</label>
                        <select name="freightForwarderId" value={formData.freightForwarderId} onChange={handleChange} className={`w-full p-2 rounded-md`}><option value="">Select...</option>{state.freightForwarders.map(ff => <option key={ff.id} value={ff.id}>{ff.name}</option>)}</select>
                        <input type="number" name="freightAmount" placeholder="Freight Amount" value={formData.freightAmount} onChange={handleChange} disabled={isFreightDisabled} className={`w-full p-2 rounded-md`} />
                        <CurrencyInput value={freightCurrencyData} onChange={setFreightCurrencyData} disabled={isFreightDisabled} />
                    </div>
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">Clearing Agent</label>
                        <select name="clearingAgentId" value={formData.clearingAgentId} onChange={handleChange} className={`w-full p-2 rounded-md`}><option value="">Select...</option>{state.clearingAgents.map(ca => <option key={ca.id} value={ca.id}>{ca.name}</option>)}</select>
                        <input type="number" name="clearingAmount" placeholder="Clearing Amount" value={formData.clearingAmount} onChange={handleChange} disabled={isClearingDisabled} className={`w-full p-2 rounded-md`} />
                        <CurrencyInput value={clearingCurrencyData} onChange={setClearingCurrencyData} disabled={isClearingDisabled} />
                    </div>
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700">Commission Agent</label>
                        <select name="commissionAgentId" value={formData.commissionAgentId} onChange={handleChange} className={`w-full p-2 rounded-md`}><option value="">Select...</option>{state.commissionAgents.map(ca => <option key={ca.id} value={ca.id}>{ca.name}</option>)}</select>
                        <input type="number" name="commissionAmount" placeholder="Commission Amount" value={formData.commissionAmount} onChange={handleChange} disabled={isCommissionDisabled} className={`w-full p-2 rounded-md`} />
                        <CurrencyInput value={commissionCurrencyData} onChange={setCommissionCurrencyData} disabled={isCommissionDisabled} />
                    </div>
                </div>
            </div>

            <div className="flex justify-end pt-4 border-t">
                <button onClick={handleFinalizePurchase} className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">Finalize Purchase</button>
            </div>
            
             {containerError && (
                <Modal isOpen={!!containerError} onClose={() => setContainerError(null)} title="Validation Error">
                    <div className="text-slate-700">
                        <p className="font-semibold text-red-600">Duplicate Container Number</p>
                        <p className="mt-2">{containerError}</p>
                        <div className="flex justify-end mt-6">
                            <button onClick={() => setContainerError(null)} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">OK</button>
                        </div>
                    </div>
                </Modal>
            )}

             {purchaseToSave && (
                <OriginalPurchaseSummaryModal 
                    isOpen={isSummaryModalOpen}
                    onClose={() => setIsSummaryModalOpen(false)}
                    onSave={handleSaveAndContinue}
                    purchase={purchaseToSave}
                    state={state}
                    hasPrinted={hasPrinted}
                    setHasPrinted={setHasPrinted}
                />
            )}
        </div>
    );
};

export default PurchasesModule;