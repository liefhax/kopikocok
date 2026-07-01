import { Tabs } from 'expo-router';
import { useWindowDimensions, View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link, usePathname } from 'expo-router';
import { BlurView } from 'expo-blur';

export default function TabLayout() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const pathname = usePathname();

  const getActiveStyle = (path: string) => {
    const isActive = pathname === path || (path === '/(tabs)' && pathname === '/(tabs)');
    return isActive;
  };

  // Custom Tab Bar Component untuk Mobile
  const CustomTabBar = ({ state, descriptors, navigation }: any) => {
    const tabs = [
      { name: 'index', label: 'Beranda', icon: 'home' },
      { name: 'items', label: 'Barang', icon: 'cube' },
      { name: 'transactions', label: 'Mutasi', icon: 'swap-horizontal' },
      { name: 'settings', label: 'Pengaturan', icon: 'settings' },
    ];

    return (
      <View style={styles.tabBarContainer}>
        <View style={styles.tabBar}>
          {tabs.map((tab, index) => {
            const isFocused = state.index === index;
            return (
              <Pressable
                key={tab.name}
                onPress={() => navigation.navigate(tab.name)}
                style={[styles.tabItem, isFocused && styles.tabItemActive]}
              >
                <Ionicons 
                  name={tab.icon as any} 
                  size={22} 
                  color={isFocused ? '#D4A373' : '#8C7B6E'} 
                />
                <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* SIDEBAR UNTUK TABLET */}
      {isTablet && (
        <View style={styles.sidebar}>
          <View style={styles.brandContainer}>
            <View style={styles.brandIcon}>
              <Ionicons name="cafe" size={28} color="#D4A373" />
            </View>
            <View style={styles.brandTextContainer}>
              <Text style={styles.brandTitle}>Kopi Kocok</Text>
              <Text style={styles.brandSubtitle}>Stock Management</Text>
            </View>
          </View>
          
          <View style={styles.sidebarMenu}>
            <Link href="/(tabs)" asChild>
              <Pressable style={[styles.sidebarItem, getActiveStyle('/(tabs)') && styles.sidebarItemActive]}>
                <Ionicons name="home-outline" size={22} color={getActiveStyle('/(tabs)') ? '#D4A373' : '#8C7B6E'} />
                <Text style={[styles.sidebarItemText, getActiveStyle('/(tabs)') && styles.sidebarItemTextActive]}>Beranda</Text>
              </Pressable>
            </Link>
            
            <Link href="/(tabs)/items" asChild>
              <Pressable style={[styles.sidebarItem, getActiveStyle('/(tabs)/items') && styles.sidebarItemActive]}>
                <Ionicons name="cube-outline" size={22} color={getActiveStyle('/(tabs)/items') ? '#D4A373' : '#8C7B6E'} />
                <Text style={[styles.sidebarItemText, getActiveStyle('/(tabs)/items') && styles.sidebarItemTextActive]}>Master Barang</Text>
              </Pressable>
            </Link>

            <Link href="/(tabs)/transactions" asChild>
              <Pressable style={[styles.sidebarItem, getActiveStyle('/(tabs)/transactions') && styles.sidebarItemActive]}>
                <Ionicons name="swap-horizontal-outline" size={22} color={getActiveStyle('/(tabs)/transactions') ? '#D4A373' : '#8C7B6E'} />
                <Text style={[styles.sidebarItemText, getActiveStyle('/(tabs)/transactions') && styles.sidebarItemTextActive]}>Mutasi Stok</Text>
              </Pressable>
            </Link>

            <Link href="/(tabs)/settings" asChild>
              <Pressable style={[styles.sidebarItem, getActiveStyle('/(tabs)/settings') && styles.sidebarItemActive]}>
                <Ionicons name="settings-outline" size={22} color={getActiveStyle('/(tabs)/settings') ? '#D4A373' : '#8C7B6E'} />
                <Text style={[styles.sidebarItemText, getActiveStyle('/(tabs)/settings') && styles.sidebarItemTextActive]}>Pengaturan</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      )}

      {/* KONTEN UTAMA */}
      <View style={styles.mainContent}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarStyle: { display: 'none' }, // Hide default tab bar
          }}
          tabBar={(props) => !isTablet && <CustomTabBar {...props} />}
        >
          <Tabs.Screen name="index" options={{ title: 'Beranda' }} />
          <Tabs.Screen name="items" options={{ title: 'Barang' }} />
          <Tabs.Screen name="transactions" options={{ title: 'Mutasi' }} />
          <Tabs.Screen name="settings" options={{ title: 'Pengaturan' }} />
        </Tabs>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    flexDirection: 'row', 
    backgroundColor: '#FAF7F2' 
  },
  
  // Sidebar untuk Tablet
  sidebar: { 
    width: 260, 
    backgroundColor: '#FDF8F5', 
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderRightWidth: 1, 
    borderRightColor: 'rgba(212,163,115,0.12)',
  },
  brandContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 40,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212,163,115,0.15)',
  },
  brandIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#5C2C06',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  brandTextContainer: {
    flex: 1,
  },
  brandTitle: { 
    fontSize: 18, 
    fontWeight: '800', 
    fontFamily: 'Outfit', 
    color: '#5C2C06' 
  },
  brandSubtitle: { 
    fontSize: 11, 
    fontFamily: 'Inter', 
    color: '#8C7B6E', 
    marginTop: 2,
  },
  sidebarMenu: { 
    flex: 1, 
    gap: 6 
  },
  sidebarItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 14, 
    paddingHorizontal: 14,
    borderRadius: 14,
    gap: 12,
  },
  sidebarItemActive: {
    backgroundColor: 'rgba(212,163,115,0.12)',
  },
  sidebarItemText: { 
    fontSize: 15, 
    fontFamily: 'Outfit',
    fontWeight: '500',
    color: '#8C7B6E' 
  },
  sidebarItemTextActive: {
    color: '#D4A373',
    fontWeight: '600',
  },
  mainContent: { 
    flex: 1,
    backgroundColor: '#FAF7F2',
  },

  // Custom Tab Bar untuk Mobile
  tabBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    paddingTop: 8,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(253,248,245,0.96)',
    borderRadius: 32,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    shadowColor: '#5C2C06',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(212,163,115,0.2)',
  },
  tabItem: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 24,
    gap: 4,
  },
  tabItemActive: {
    backgroundColor: '#5C2C06',
  },
  tabLabel: {
    fontSize: 11,
    fontFamily: 'Outfit',
    fontWeight: '500',
    color: '#8C7B6E',
  },
  tabLabelActive: {
    color: '#D4A373',
    fontWeight: '600',
  },
});