import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions, TouchableOpacity, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router'; 
import { getDB } from '../../database/db';

interface DashboardStats {
  totalItems: number;
  lowStockItems: number;
  totalAssetValue: number;
  potentialRevenue: number;
}

interface RecentTransaction {
  id: number;
  item_name: string;
  type: string;
  quantity: number;
  date: string;
}

export default function DashboardScreen() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const router = useRouter();

  const [stats, setStats] = useState<DashboardStats>({
    totalItems: 0, lowStockItems: 0, totalAssetValue: 0, potentialRevenue: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const [limitIndicator, setLimitIndicator] = useState(5);

  useFocusEffect(
    useCallback(() => {
      fetchDashboardData();
    }, [])
  );
const fetchDashboardData = async () => {
  try {
    const db = await getDB();
    
    // Gunakan try-catch untuk setiap query agar tidak mengganggu yang lain
    let limit = 5;
    try {
      const thresholdRow = await db.getFirstAsync<{value: string}>(
        'SELECT value FROM app_settings WHERE key = "low_stock_threshold"'
      );
      if (thresholdRow) {
        limit = parseInt(thresholdRow.value) || 5;
      }
    } catch (e) {
      console.warn("Gagal mengambil threshold, menggunakan default 5");
    }
    setLimitIndicator(limit);
    
    let totalItems = 0;
    try {
      const totalItemsResult = await db.getFirstAsync<{count: number}>(
        'SELECT COUNT(*) as count FROM items'
      );
      totalItems = totalItemsResult?.count || 0;
    } catch (e) {
      console.warn("Gagal mengambil total items");
    }
    
    let lowStockItems = 0;
    try {
      const lowStockResult = await db.getFirstAsync<{count: number}>(
        `SELECT COUNT(*) as count FROM items WHERE stock <= ? AND stock > 0`, 
        [limit]
      );
      lowStockItems = lowStockResult?.count || 0;
    } catch (e) {
      console.warn("Gagal mengambil low stock items");
    }
    
    let totalAsset = 0;
    let totalRevenue = 0;
    try {
      const valueResult = await db.getFirstAsync<{totalAsset: number, totalRevenue: number}>(`
        SELECT SUM(stock * cost_price) as totalAsset, SUM(stock * sell_price) as totalRevenue FROM items WHERE stock > 0
      `);
      totalAsset = valueResult?.totalAsset || 0;
      totalRevenue = valueResult?.totalRevenue || 0;
    } catch (e) {
      console.warn("Gagal mengambil nilai aset");
    }

    setStats({
      totalItems,
      lowStockItems,
      totalAssetValue: totalAsset,
      potentialRevenue: totalRevenue,
    });

    let recentTx: RecentTransaction[] = [];
    try {
      recentTx = await db.getAllAsync<RecentTransaction>(`
        SELECT t.id, t.type, t.quantity, t.date, i.name as item_name 
        FROM transactions t 
        JOIN items i ON t.item_id = i.id 
        ORDER BY t.date DESC 
        LIMIT 5
      `);
    } catch (e) {
      console.warn("Gagal mengambil transaksi terbaru");
    }
    setRecentTransactions(recentTx);

  } catch (error) {
    console.error("Gagal mengambil data dashboard:", error);
  }
};

  const formatRupiah = (number: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(number || 0);
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Selamat Pagi";
    if (hour < 18) return "Selamat Siang";
    return "Selamat Malam";
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView 
        contentContainerStyle={styles.container} 
        showsVerticalScrollIndicator={false}
      >
        {/* Header with Avatar - Like Figma */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerSubtitle}>{getGreeting()},</Text>
            <Text style={styles.headerTitle}>Kopi Kocok</Text>
            <Text style={styles.headerDesc}>Ringkasan stok hari ini</Text>
          </View>
          {/* Ganti bagian ini di dalam view avatarContainer Anda */}
<View style={styles.avatarContainer}>
  <Image 
    source={require('../../assets/images/profile.jpeg')} // Sesuaikan path gambar Anda
    style={styles.avatarImage} 
  />
</View>
        </View>

        {/* Hero Card - Premium Design */}
        <View style={styles.heroCard}>
          {/* Decorative elements */}
          <View style={styles.heroDecoration1} />
          <View style={styles.heroDecoration2} />
          <View style={styles.heroDecoration3} />
          
          <View style={styles.heroTop}>
            <Text style={styles.heroLabel}>Total Nilai Aset</Text>
            <Ionicons name="wallet-outline" size={24} color="rgba(253,248,245,0.7)" />
          </View>
          <Text style={styles.heroValue}>{formatRupiah(stats.totalAssetValue)}</Text>
          
          <View style={styles.heroDivider} />
          
          <View style={styles.heroBottom}>
            <View>
              <Text style={styles.heroLabelSmall}>Estimasi Pendapatan</Text>
              <Text style={styles.heroSubValue}>{formatRupiah(stats.potentialRevenue)}</Text>
            </View>
            <TouchableOpacity 
              style={styles.heroButton} 
              onPress={() => router.push('/(tabs)/items')}
            >
              <Text style={styles.heroButtonText}>Lihat Detail</Text>
              <Ionicons name="chevron-forward" size={14} color="#D4A373" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Summary Cards - Neumorphism style */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, isTablet && styles.statCardTablet]}>
            <View style={[styles.statIcon, { backgroundColor: '#E3F0FF' }]}>
              <Ionicons name="cube-outline" size={20} color="#4A90D9" />
            </View>
            <View>
              <Text style={styles.statLabel}>Total Inventaris</Text>
              <Text style={styles.statValue}>{stats.totalItems}</Text>
              <Text style={styles.statSub}>Item Aktif</Text>
            </View>
          </View>

          <View style={[styles.statCard, isTablet && styles.statCardTablet]}>
            <View style={[styles.statIcon, { backgroundColor: '#FFEBEE' }]}>
              <Ionicons name="alert-circle-outline" size={20} color="#E53935" />
            </View>
            <View>
              <Text style={styles.statLabel}>Stok Menipis</Text>
              <Text style={[styles.statValue, { color: '#E53935' }]}>{stats.lowStockItems}</Text>
              <Text style={styles.statSub}>Perlu Restok</Text>
            </View>
          </View>
        </View>

        {/* Recent Activity Section */}
        <View style={styles.activitySection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Aktivitas Mutasi Terakhir</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/transactions')}>
              <Text style={styles.seeAllText}>Lihat Semua</Text>
            </TouchableOpacity>
          </View>

          {recentTransactions.length > 0 ? (
            recentTransactions.map((tx, index) => {
              const isIN = tx.type === 'IN';
              return (
                <View key={tx.id} style={styles.activityCard}>
                  <View style={styles.activityIcon}>
                    <Ionicons 
                      name={isIN ? 'arrow-down' : 'arrow-up'} 
                      size={18} 
                      color={isIN ? '#2E7D32' : '#C62828'} 
                    />
                  </View>
                  <View style={styles.activityContent}>
                    <Text style={styles.activityName}>{tx.item_name}</Text>
                    <Text style={styles.activityDate}>{formatDate(tx.date)}</Text>
                  </View>
                  <Text style={[styles.activityQty, { color: isIN ? '#2E7D32' : '#C62828' }]}>
                    {isIN ? '+' : '-'}{tx.quantity}
                  </Text>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="swap-horizontal-outline" size={48} color="#DDD7CE" />
              <Text style={styles.emptyText}>Belum ada aktivitas mutasi</Text>
            </View>
          )}
        </View>

        {/* Quick Action FAB */}
        <TouchableOpacity 
          style={styles.quickActionBtn} 
          onPress={() => router.push('/(tabs)/transactions')}
        >
          <Ionicons name="add" size={20} color="#FDF8F5" />
          <Text style={styles.quickActionText}>Tambah Mutasi Stok</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF7F2',
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 100,
  },
  
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter',
    color: '#8C7B6E',
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    fontFamily: 'Outfit',
    color: '#5C2C06',
    letterSpacing: -0.5,
  },
  headerDesc: {
    fontSize: 13,
    fontFamily: 'Inter',
    color: '#B0A090',
    marginTop: 2,
  },
  avatarContainer: {
    // Pastikan container ini memiliki dimensi yang pas
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden', // Penting agar gambar tidak keluar dari lingkaran
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },

  // Hero Card
  heroCard: {
    backgroundColor: '#3D1A02',
    borderRadius: 28,
    padding: 24,
    marginBottom: 24,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#5C2C06',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  heroDecoration1: {
    position: 'absolute',
    right: -20,
    top: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: 'rgba(212,163,115,0.08)',
  },
  heroDecoration2: {
    position: 'absolute',
    right: -40,
    top: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 2,
    borderColor: 'rgba(212,163,115,0.05)',
  },
  heroDecoration3: {
    position: 'absolute',
    right: 20,
    bottom: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(212,163,115,0.05)',
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  heroLabel: {
    fontSize: 12,
    fontFamily: 'Inter',
    color: 'rgba(253,248,245,0.6)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heroLabelSmall: {
    fontSize: 11,
    fontFamily: 'Inter',
    color: 'rgba(253,248,245,0.5)',
  },
  heroValue: {
    fontSize: 34,
    fontWeight: '800',
    fontFamily: 'Outfit',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  heroDivider: {
    height: 1,
    backgroundColor: 'rgba(212,163,115,0.2)',
    marginVertical: 16,
  },
  heroBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  heroSubValue: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'Outfit',
    color: '#D4A373',
    marginTop: 4,
  },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(212,163,115,0.5)',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
  },
  heroButtonText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Outfit',
    color: '#D4A373',
  },

  // Stats Cards
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
    gap: 14,
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDF8F5',
    padding: 16,
    borderRadius: 20,
    gap: 12,
    shadowColor: '#A07850',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  statCardTablet: {
    marginHorizontal: 0,
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    fontSize: 11,
    fontFamily: 'Inter',
    color: '#8C7B6E',
    fontWeight: '500',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    fontFamily: 'Outfit',
    color: '#5C2C06',
  },
  statSub: {
    fontSize: 9,
    fontFamily: 'Inter',
    color: '#B0A090',
    marginTop: 2,
  },

  // Activity Section
  activitySection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: 'Outfit',
    color: '#5C2C06',
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Outfit',
    color: '#D4A373',
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDF8F5',
    padding: 14,
    borderRadius: 18,
    marginBottom: 10,
    shadowColor: '#A07850',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  activityIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    backgroundColor: '#FFFFFF',
    shadowColor: '#A07850',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
  },
  activityContent: {
    flex: 1,
  },
  activityName: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Outfit',
    color: '#2C1A0E',
    marginBottom: 3,
  },
  activityDate: {
    fontSize: 11,
    fontFamily: 'Inter',
    color: '#B0A090',
  },
  activityQty: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'Outfit',
  },

  // Quick Action
  quickActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#5C2C06',
    borderRadius: 30,
    paddingVertical: 16,
    marginTop: 8,
    gap: 10,
    shadowColor: '#5C2C06',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  quickActionText: {
    color: '#FDF8F5',
    fontFamily: 'Outfit',
    fontWeight: '700',
    fontSize: 15,
  },

  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: '#FDF8F5',
    borderRadius: 20,
  },
  emptyText: {
    marginTop: 12,
    color: '#B0A090',
    fontFamily: 'Inter',
    fontSize: 14,
  },
});