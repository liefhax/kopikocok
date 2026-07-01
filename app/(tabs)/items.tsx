import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, ScrollView, Alert, Image, useWindowDimensions, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router'; 
import { getDB } from '../../database/db';

interface Item {
  id: number; name: string; category: string; stock: number; unit: string;
  price: number; cost_price: number; sell_price: number; description: string | null; image_uri: string | null;
}

export default function ItemsScreen() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const numColumns = isTablet ? 2 : 1;

  const [items, setItems] = useState<Item[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [swipedId, setSwipedId] = useState<number | null>(null);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [stock, setStock] = useState(''); 
  const [unit, setUnit] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);

  const [optionModalVisible, setOptionModalVisible] = useState(false);
  const [optionType, setOptionType] = useState<'category' | 'unit'>('category');
  const [newOptionText, setNewOptionText] = useState('');
  
  const [categories, setCategories] = useState<string[]>([]);
  const [units, setUnits] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      fetchItems();
    }, [])
  );

  const getCategoryColor = (cat: string) => {
    const colors: Record<string, string> = {
      'Biji Kopi': '#D4A373',
      'Susu': '#7BA3C8',
      'Bahan Dasar': '#A8C5A0',
      'Sirup': '#E8897A',
    };
    return colors[cat] || '#D4A373';
  };

// Ganti fungsi fetchItems dengan ini:
const fetchItems = async () => {
  try {
    const db = await getDB();
    const result = await db.getAllAsync<Item>('SELECT * FROM items ORDER BY id DESC');
    setItems(result);

    try {
      const catResult = await db.getAllAsync<{name: string}>('SELECT name FROM categories ORDER BY name ASC');
      setCategories(catResult.map(c => c.name));
    } catch (e) {
      console.warn("Gagal mengambil categories");
    }

    try {
      const unitResult = await db.getAllAsync<{name: string}>('SELECT name FROM units ORDER BY name ASC');
      setUnits(unitResult.map(u => u.name));
    } catch (e) {
      console.warn("Gagal mengambil units");
    }
  } catch (error) {
    console.error("Gagal mengambil data:", error);
  }
};

  const openAddModal = () => {
    setIsEditing(false); setSelectedId(null); resetForm(); setModalVisible(true);
  };

  const openEditModal = (item: Item) => {
    setIsEditing(true); setSelectedId(item.id); setName(item.name); setCategory(item.category);
    setStock(item.stock.toString()); setUnit(item.unit);
    setCostPrice((item.cost_price || 0).toString()); setSellPrice((item.sell_price || item.price || 0).toString());
    setDescription(item.description || ''); setImageUri(item.image_uri || null); setModalVisible(true);
  };

  const resetForm = () => {
    setName(''); setCategory(''); setStock(''); setUnit(''); setCostPrice(''); setSellPrice(''); setDescription(''); setImageUri(null);
  };

  const handlePickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.7 });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const handleSave = async () => {
    if (!name || !category || !unit || !sellPrice) {
      Alert.alert('Error', 'Nama, Kategori, Satuan, dan Harga Jual wajib diisi!'); return;
    }

    try {
      const db = await getDB();
      if (isEditing && selectedId) {
        await db.runAsync(
          `UPDATE items SET name = ?, category = ?, stock = ?, unit = ?, cost_price = ?, sell_price = ?, description = ?, image_uri = ? WHERE id = ?`,
          [name, category, parseFloat(stock) || 0, unit, parseFloat(costPrice) || 0, parseFloat(sellPrice) || 0, description, imageUri, selectedId]
        );
      } else {
        await db.runAsync(
          `INSERT INTO items (name, category, stock, unit, cost_price, sell_price, description, image_uri) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [name, category, parseFloat(stock) || 0, unit, parseFloat(costPrice) || 0, parseFloat(sellPrice) || 0, description, imageUri]
        );
      }
      setModalVisible(false); fetchItems(); resetForm();
    } catch (error) {
      Alert.alert('Error', 'Gagal menyimpan data barang.'); console.error(error);
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert('Hapus Barang', 'Yakin ingin menghapus barang ini? Data Mutasi terkait juga akan kehilangan referensi.', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: async () => {
          try {
            const db = await getDB(); await db.runAsync('DELETE FROM items WHERE id = ?', [id]); fetchItems();
          } catch (error) { Alert.alert('Error', 'Gagal menghapus data'); }
        }
      }
    ]);
  };

  const formatRupiah = (number: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(number);
  };

  const handleAddNewOption = async () => {
    if (!newOptionText.trim()) return;
    
    const db = await getDB();
    try {
      if (optionType === 'category') {
        await db.runAsync('INSERT OR IGNORE INTO categories (name) VALUES (?)', [newOptionText]);
        setCategory(newOptionText);
      } else {
        await db.runAsync('INSERT OR IGNORE INTO units (name) VALUES (?)', [newOptionText]);
        setUnit(newOptionText);
      }
      setNewOptionText(''); setOptionModalVisible(false); fetchItems();
    } catch(e) {
      console.log(e);
    }
  };

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderItem = ({ item }: { item: Item }) => {
    const isLow = item.stock <= 5;
    const categoryColor = getCategoryColor(item.category);
    
    return (
      <View style={[styles.card, isTablet && styles.cardTablet]}>
        <View style={styles.cardMain}>
          {item.image_uri ? (
            <Image source={{ uri: item.image_uri }} style={styles.itemImage} />
          ) : (
            <View style={[styles.itemImage, styles.itemImagePlaceholder]}>
              <Ionicons name="image-outline" size={28} color="#ccc" />
            </View>
          )}
          <View style={styles.cardContent}>
            <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
            <View style={styles.categoryBadge}>
              <Text style={[styles.categoryText, { backgroundColor: `${categoryColor}22`, color: categoryColor }]}>
                {item.category}
              </Text>
            </View>
            <View style={styles.priceContainer}>
              <Text style={styles.costPrice}>Modal: {formatRupiah(item.cost_price || 0)}</Text>
              <Text style={styles.sellPrice}>Jual: {formatRupiah(item.sell_price || item.price || 0)}</Text>
            </View>
          </View>
          <View style={styles.stockContainer}>
            <Text style={[styles.stockValue, isLow && styles.stockLow]}>
              {item.stock}
            </Text>
            <Text style={styles.unitText}>{item.unit}</Text>
            {isLow && <Text style={styles.lowStockBadge}>Menipis!</Text>}
          </View>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => openEditModal(item)}>
            <Ionicons name="create-outline" size={22} color="#4A90D9" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => handleDelete(item.id)}>
            <Ionicons name="trash-outline" size={22} color="#E53935" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Master Barang</Text>
        <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
          <Ionicons name="add" size={24} color="#FDF8F5" />
          <Text style={styles.addButtonText}>Tambah</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#8C7B6E" style={styles.searchIcon} />
        <TextInput 
          style={styles.searchInput} 
          placeholder="Cari nama atau kategori..." 
          placeholderTextColor="#B0A090"
          value={searchQuery} 
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#8C7B6E" />
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.resultCount}>{filteredItems.length} barang ditemukan</Text>

      <FlatList
        key={isTablet ? 'tablet-col' : 'mobile-col'}
        numColumns={numColumns}
        columnWrapperStyle={isTablet ? styles.rowGrid : undefined}
        data={filteredItems}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="cube-outline" size={60} color="#DDD7CE" />
            <Text style={styles.emptyText}>Tidak ada barang yang ditemukan.</Text>
          </View>
        }
      />

      {/* Modal for Add/Edit - same as before but with updated colors */}
      <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{isEditing ? 'Edit Barang' : 'Tambah Barang Baru'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#5C2C06" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formContainer} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.imagePickerContainer}>
                <TouchableOpacity onPress={handlePickImage} style={styles.imagePickerBtn}>
                  {imageUri ? (
                    <Image source={{ uri: imageUri }} style={styles.previewImage} />
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <Ionicons name="camera" size={40} color="#D4A373" />
                      <Text style={styles.imagePlaceholderText}>Tambah foto</Text>
                    </View>
                  )}
                </TouchableOpacity>
                {imageUri && (
                  <TouchableOpacity onPress={() => setImageUri(null)} style={styles.removeImageBtn}>
                    <Text style={styles.removeImageText}>Hapus Foto</Text>
                  </TouchableOpacity>
                )}
              </View>

              <Text style={styles.label}>Nama Barang *</Text>
              <TextInput style={styles.input} placeholder="Contoh: Kopi Arabica Gayo" value={name} onChangeText={setName} />

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                  <Text style={styles.label}>Kategori *</Text>
                  <TouchableOpacity style={styles.selectButton} onPress={() => { setOptionType('category'); setOptionModalVisible(true); }}>
                    <Text style={{ color: category ? '#2C1A0E' : '#B0A090' }}>{category || 'Pilih Kategori'}</Text>
                    <Ionicons name="chevron-down" size={20} color="#8C7B6E" />
                  </TouchableOpacity>
                </View>

                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Satuan *</Text>
                  <TouchableOpacity style={styles.selectButton} onPress={() => { setOptionType('unit'); setOptionModalVisible(true); }}>
                    <Text style={{ color: unit ? '#2C1A0E' : '#B0A090' }}>{unit || 'Pilih Satuan'}</Text>
                    <Ionicons name="chevron-down" size={20} color="#8C7B6E" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                  <Text style={styles.label}>Stok Awal</Text>
                  <TextInput 
                    style={[styles.input, isEditing && { backgroundColor: '#EDE8E2' }]} 
                    placeholder="0" 
                    keyboardType="numeric" 
                    value={stock} 
                    onChangeText={setStock} 
                    editable={!isEditing} 
                  />
                  {isEditing && <Text style={styles.editStockHint}>*Ubah stok via halaman Mutasi</Text>}
                </View>
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                  <Text style={styles.label}>Harga Modal</Text>
                  <TextInput style={styles.input} placeholder="0" keyboardType="numeric" value={costPrice} onChangeText={setCostPrice} />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Harga Jual *</Text>
                  <TextInput style={styles.input} placeholder="0" keyboardType="numeric" value={sellPrice} onChangeText={setSellPrice} />
                </View>
              </View>

              <Text style={styles.label}>Deskripsi (Opsional)</Text>
              <TextInput 
                style={[styles.input, styles.textArea]} 
                placeholder="Contoh: Roast date 12 Okt" 
                multiline 
                numberOfLines={3} 
                value={description} 
                onChangeText={setDescription} 
              />

              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveButtonText}>Simpan Barang</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {optionModalVisible && (
            <View style={styles.optionModalOverlay}>
              <View style={styles.optionModalContent}>
                <Text style={styles.optionModalTitle}>Pilih {optionType === 'category' ? 'Kategori' : 'Satuan'}</Text>
                <View style={styles.newOptionContainer}>
                  <TextInput 
                    style={styles.newOptionInput} 
                    placeholder={`Ketik baru...`} 
                    placeholderTextColor="#B0A090"
                    value={newOptionText} 
                    onChangeText={setNewOptionText} 
                  />
                  <TouchableOpacity style={styles.addOptionBtn} onPress={handleAddNewOption}>
                    <Text style={styles.addOptionBtnText}>Tambah</Text>
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={optionType === 'category' ? categories : units}
                  keyExtractor={(item, index) => index.toString()}
                  keyboardShouldPersistTaps="handled" 
                  renderItem={({ item }) => (
                    <TouchableOpacity style={styles.optionItem} onPress={() => {
                        if (optionType === 'category') setCategory(item); else setUnit(item);
                        setOptionModalVisible(false);
                      }}>
                      <Text style={styles.optionItemText}>{item}</Text>
                      {((optionType === 'category' && category === item) || (optionType === 'unit' && unit === item)) && (
                        <Ionicons name="checkmark-circle" size={24} color="#D4A373" />
                      )}
                    </TouchableOpacity>
                  )}
                  style={styles.optionList}
                />
                <TouchableOpacity style={styles.closeOptionBtn} onPress={() => setOptionModalVisible(false)}>
                  <Text style={styles.closeOptionBtnText}>Tutup</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF7F2' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 20, 
    backgroundColor: '#FAF7F2',
  },
  title: { 
    fontSize: 22, 
    fontWeight: '800', 
    fontFamily: 'Outfit', 
    color: '#5C2C06' 
  },
  addButton: { 
    flexDirection: 'row', 
    backgroundColor: '#5C2C06', 
    paddingHorizontal: 15, 
    paddingVertical: 10, 
    borderRadius: 12, 
    alignItems: 'center',
    shadowColor: '#5C2C06',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  addButtonText: { 
    color: '#FDF8F5', 
    fontWeight: '600', 
    fontFamily: 'Outfit',
    marginLeft: 6,
    fontSize: 14,
  },
  
  searchContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FDF8F5', 
    marginHorizontal: 20, 
    marginBottom: 12,
    paddingHorizontal: 16, 
    borderRadius: 16, 
    shadowColor: '#5C2C06',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  searchIcon: { marginRight: 10 },
  searchInput: { 
    flex: 1, 
    paddingVertical: 14, 
    fontSize: 15, 
    fontFamily: 'Inter',
    color: '#2C1A0E',
  },
  resultCount: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: '#8C7B6E',
    marginHorizontal: 20,
    marginBottom: 12,
  },

  listContainer: { padding: 16, paddingBottom: 80 },
  rowGrid: { justifyContent: 'space-between' },
  
  card: { 
    backgroundColor: '#FDF8F5', 
    borderRadius: 18, 
    padding: 14, 
    marginBottom: 16, 
    shadowColor: '#5C2C06',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTablet: { width: '48%' },
  cardMain: { flexDirection: 'row', alignItems: 'center' },
  itemImage: { 
    width: 58, 
    height: 58, 
    borderRadius: 14, 
    marginRight: 14, 
    backgroundColor: '#EDE8E2',
    marginTop: -6,
    borderWidth: 2,
    borderColor: 'rgba(212,163,115,0.3)',
  },
  itemImagePlaceholder: { 
    alignItems: 'center', 
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DDD7CE',
    borderStyle: 'dashed',
  },
  cardContent: { flex: 1 },
  itemName: { 
    fontSize: 15, 
    fontWeight: '700', 
    fontFamily: 'Outfit', 
    color: '#2C1A0E', 
    marginBottom: 4,
  },
  categoryBadge: { marginBottom: 6 },
  categoryText: {
    fontSize: 11,
    fontFamily: 'Inter',
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 20,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  priceContainer: { flexDirection: 'row', gap: 8, marginTop: 2 },
  costPrice: { 
    fontSize: 11, 
    fontFamily: 'Inter', 
    color: '#8C7B6E',
    backgroundColor: '#EDE8E2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  sellPrice: { 
    fontSize: 11, 
    fontFamily: 'Inter', 
    fontWeight: '600', 
    color: '#2E7D32',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  stockContainer: { alignItems: 'flex-end', marginLeft: 8 },
  stockValue: { 
    fontSize: 20, 
    fontWeight: '800', 
    fontFamily: 'Outfit', 
    color: '#5C2C06',
  },
  stockLow: { color: '#E53935' },
  unitText: { 
    fontSize: 11, 
    fontFamily: 'Inter', 
    color: '#8C7B6E',
  },
  lowStockBadge: {
    fontSize: 9,
    fontFamily: 'Inter',
    fontWeight: '600',
    color: '#E53935',
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 3,
  },
  
  actionButtons: { 
    flexDirection: 'row', 
    justifyContent: 'flex-end', 
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(92,44,6,0.06)',
  },
  iconBtn: { 
    padding: 8, 
    backgroundColor: '#FDF8F5', 
    borderRadius: 10, 
    marginLeft: 12,
    shadowColor: '#5C2C06',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 50 },
  emptyText: { color: '#B0A090', marginTop: 10, fontSize: 16, fontFamily: 'Inter' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(45,25,10,0.6)', justifyContent: 'flex-end', zIndex: 1 },
  modalContent: { backgroundColor: '#FDF8F5', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(92,44,6,0.08)' },
  modalTitle: { fontSize: 18, fontWeight: '700', fontFamily: 'Outfit', color: '#5C2C06' },
  formContainer: { padding: 20 },
  scrollContent: { paddingBottom: 40 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  inputGroup: { marginBottom: 15 },
  label: { fontSize: 13, color: '#8C7B6E', marginBottom: 8, fontWeight: '600', fontFamily: 'Outfit' },
  input: { 
    backgroundColor: '#FFFFFF', 
    borderWidth: 1, 
    borderColor: '#EDE8E2', 
    borderRadius: 14, 
    padding: 14, 
    fontSize: 15, 
    fontFamily: 'Inter', 
    color: '#2C1A0E',
  },
  selectButton: { 
    backgroundColor: '#FFFFFF', 
    borderWidth: 1, 
    borderColor: '#EDE8E2', 
    borderRadius: 14, 
    padding: 14, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
  },
  textArea: { height: 80, textAlignVertical: 'top' },
  editStockHint: { fontSize: 10, color: '#E53935', marginTop: 4, fontFamily: 'Inter' },
  
  imagePickerContainer: { alignItems: 'center', marginBottom: 20 },
  imagePickerBtn: { width: 110, height: 110, borderRadius: 16, overflow: 'hidden', backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#D4A373', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  previewImage: { width: '100%', height: '100%' },
  imagePlaceholder: { alignItems: 'center' },
  imagePlaceholderText: { fontSize: 11, color: '#D4A373', marginTop: 6, fontFamily: 'Inter' },
  removeImageBtn: { marginTop: 8 },
  removeImageText: { color: '#E53935', fontSize: 12, fontFamily: 'Inter', fontWeight: '500' },
  
  saveButton: { backgroundColor: '#5C2C06', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 20 },
  saveButtonText: { color: '#FDF8F5', fontSize: 16, fontWeight: '700', fontFamily: 'Outfit' },

  optionModalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(45,25,10,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 1000, elevation: 10 },
  optionModalContent: { backgroundColor: '#FDF8F5', width: '85%', maxHeight: '70%', borderRadius: 20, padding: 20 },
  optionModalTitle: { fontSize: 18, fontWeight: '700', fontFamily: 'Outfit', color: '#5C2C06', marginBottom: 15, textAlign: 'center' },
  newOptionContainer: { flexDirection: 'row', marginBottom: 15 },
  newOptionInput: { flex: 1, borderWidth: 1, borderColor: '#EDE8E2', borderRadius: 12, padding: 12, marginRight: 10, fontFamily: 'Inter' },
  addOptionBtn: { backgroundColor: '#D4A373', paddingHorizontal: 15, justifyContent: 'center', borderRadius: 12 },
  addOptionBtnText: { color: '#FDF8F5', fontWeight: '600' },
  optionList: { flexGrow: 0 },
  optionItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(92,44,6,0.06)' },
  optionItemText: { fontSize: 15, fontFamily: 'Inter', color: '#2C1A0E' },
  closeOptionBtn: { marginTop: 20, padding: 12, backgroundColor: '#EDE8E2', borderRadius: 12, alignItems: 'center' },
  closeOptionBtnText: { color: '#5C2C06', fontWeight: '600', fontFamily: 'Outfit' },
});